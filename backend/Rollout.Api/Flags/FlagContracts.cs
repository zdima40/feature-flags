using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Rollout.Api.Flags;

[JsonConverter(typeof(JsonStringEnumConverter<FlagEnvironment>))]
public enum FlagEnvironment
{
    Development,
    Staging,
    Production
}

public sealed record CreateFlagRequest(
    [property: Required] string? Key,
    [property: Required] string? Name,
    string? Description,
    [property: Required] string? Environment,
    [property: Required] bool? Enabled,
    [property: Required, Range(0, 100)] int? RolloutPercentage);

public sealed class PatchFlagRequest
{
    public string? Key { get; init { field = value; HasKey = true; } }
    public string? Name { get; init { field = value; HasName = true; } }
    public string? Description { get; init { field = value; HasDescription = true; } }
    public string? Environment { get; init { field = value; HasEnvironment = true; } }
    public bool? Enabled { get; init { field = value; HasEnabled = true; } }
    [Range(0, 100)]
    public int? RolloutPercentage { get; init { field = value; HasRolloutPercentage = true; } }

    internal bool HasKey { get; private set; }
    internal bool HasName { get; private set; }
    internal bool HasDescription { get; private set; }
    internal bool HasEnvironment { get; private set; }
    internal bool HasEnabled { get; private set; }
    internal bool HasRolloutPercentage { get; private set; }
}

public sealed record FlagResponse(
    Guid Id, string Key, string Name, string? Description, DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc, IReadOnlyList<EnvironmentSettingsResponse> Environments);

public sealed record EnvironmentSettingsResponse(
    FlagEnvironment Environment, bool Enabled, int RolloutPercentage, DateTime UpdatedAtUtc);

public sealed record FlagListItem(
    Guid Id, string Key, string Name, string? Description, FlagEnvironment Environment,
    bool Enabled, int RolloutPercentage, DateTime UpdatedAtUtc);

public sealed record FlagAuditItem(
    Guid Id, Guid FeatureFlagId, FlagEnvironment? Environment, string Field,
    string? OldValue, string? NewValue, string Actor, DateTime ChangedAtUtc);

public sealed record PageResponse<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
