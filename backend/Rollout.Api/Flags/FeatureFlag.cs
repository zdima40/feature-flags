using System.Globalization;

namespace Rollout.Api.Flags;

internal sealed class FeatureFlag
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Key { get; init; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime UpdatedAtUtc { get; set; }
    public List<FlagEnvironmentSettings> Environments { get; } = [];
    public List<FlagAuditEvent> History { get; } = [];

    internal static FeatureFlag Create(
        string key, string name, string? description, FlagEnvironment environment,
        bool enabled, int rolloutPercentage, DateTime now)
    {
        var flag = new FeatureFlag
        {
            Key = key,
            Name = name,
            Description = description,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        foreach (var target in Enum.GetValues<FlagEnvironment>())
        {
            flag.Environments.Add(new FlagEnvironmentSettings
            {
                FeatureFlagId = flag.Id,
                Environment = target,
                Enabled = target == environment && enabled,
                RolloutPercentage = target == environment ? rolloutPercentage : 0,
                UpdatedAtUtc = now
            });
        }
        flag.Record("created", null, key, now);
        return flag;
    }

    internal bool Apply(PatchFlagRequest request, FlagEnvironment environment, DateTime now)
    {
        var previousEventCount = History.Count;
        if (request.Name is { } name && name != Name)
        {
            Record("name", Name, name, now);
            Name = name;
            UpdatedAtUtc = now;
        }
        if (request.HasDescription && request.Description != Description)
        {
            Record("description", Description, request.Description, now);
            Description = request.Description;
            UpdatedAtUtc = now;
        }
        if (request.HasEnabled || request.HasRolloutPercentage)
            ApplyEnvironment(request, environment, now);

        return History.Count != previousEventCount;
    }

    private void ApplyEnvironment(PatchFlagRequest request, FlagEnvironment environment, DateTime now)
    {
        var settings = Environments.Single(item => item.Environment == environment);
        if (request.Enabled is { } enabled && enabled != settings.Enabled)
        {
            Record("enabled", BooleanText(settings.Enabled), BooleanText(enabled), now, environment);
            settings.Enabled = enabled;
            settings.UpdatedAtUtc = now;
        }
        if (request.RolloutPercentage is { } rollout && rollout != settings.RolloutPercentage)
        {
            Record("rolloutPercentage", settings.RolloutPercentage.ToString(CultureInfo.InvariantCulture),
                rollout.ToString(CultureInfo.InvariantCulture), now, environment);
            settings.RolloutPercentage = rollout;
            settings.UpdatedAtUtc = now;
        }
    }

    private void Record(string field, string? oldValue, string? newValue, DateTime now,
        FlagEnvironment? environment = null) =>
        History.Add(new FlagAuditEvent
        {
            FeatureFlagId = Id,
            Environment = environment,
            Field = field,
            OldValue = oldValue,
            NewValue = newValue,
            Actor = "demo-user",
            ChangedAtUtc = now
        });

    private static string BooleanText(bool value) => value ? "true" : "false";

    internal FlagResponse ToResponse() => new(Id, Key, Name, Description, CreatedAtUtc, UpdatedAtUtc,
        Environments.OrderBy(item => item.Environment)
            .Select(item => new EnvironmentSettingsResponse(
                item.Environment, item.Enabled, item.RolloutPercentage, item.UpdatedAtUtc))
            .ToArray());
}

internal sealed class FlagEnvironmentSettings
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid FeatureFlagId { get; init; }
    public FeatureFlag Flag { get; init; } = null!;
    public FlagEnvironment Environment { get; init; }
    public bool Enabled { get; set; }
    public int RolloutPercentage { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

internal sealed class FlagAuditEvent
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid FeatureFlagId { get; init; }
    public FlagEnvironment? Environment { get; init; }
    public required string Field { get; init; }
    public string? OldValue { get; init; }
    public string? NewValue { get; init; }
    public required string Actor { get; init; }
    public DateTime ChangedAtUtc { get; init; }
}
