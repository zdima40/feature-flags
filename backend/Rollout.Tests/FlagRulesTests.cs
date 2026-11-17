using Rollout.Api.Flags;

namespace Rollout.Tests;

public sealed class FlagRulesTests
{
    private static readonly DateTime CreatedAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(null, false)]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    [InlineData(100, true)]
    [InlineData(101, false)]
    public void Rollout_validation_applies_to_create_and_patch(int? rollout, bool valid)
    {
        var create = new CreateFlagRequest("Checkout", "Checkout", null, "Staging", true, rollout);
        var patch = new PatchFlagRequest { Environment = "Staging", RolloutPercentage = rollout };

        Assert.Equal(valid, FlagValidation.Create(create, out _).Count == 0);
        Assert.Equal(valid, FlagValidation.Patch(patch, out _).Count == 0);
    }

    [Fact]
    public void Creation_sets_defaults_and_records_one_event()
    {
        var flag = FeatureFlag.Create("New-Checkout", "Checkout", null, FlagEnvironment.Staging, true, 80, CreatedAt);

        Assert.Collection(flag.Environments,
            development => AssertSettings(development, FlagEnvironment.Development, false, 0),
            staging => AssertSettings(staging, FlagEnvironment.Staging, true, 80),
            production => AssertSettings(production, FlagEnvironment.Production, false, 0));
        var audit = Assert.Single(flag.History);
        Assert.Equal(("created", null, "New-Checkout", "demo-user", CreatedAt),
            (audit.Field, audit.OldValue, audit.NewValue, audit.Actor, audit.ChangedAtUtc));
        Assert.Null(audit.Environment);
    }

    [Fact]
    public void Patch_audits_only_changes_and_preserves_timestamps_on_repeat()
    {
        var changedAt = CreatedAt.AddMinutes(1);
        var flag = FeatureFlag.Create("checkout", "Checkout", "Old description", FlagEnvironment.Staging, true, 80,
            CreatedAt);
        var patch = new PatchFlagRequest { Name = "Checkout", Description = null, Enabled = false, RolloutPercentage = 0 };

        Assert.True(flag.Apply(patch, FlagEnvironment.Staging, changedAt));
        Assert.False(flag.Apply(patch, FlagEnvironment.Staging, changedAt.AddMinutes(1)));

        Assert.Equal("Checkout", flag.Name);
        Assert.Null(flag.Description);
        Assert.Equal(changedAt, flag.UpdatedAtUtc);
        Assert.Equal(new[] { CreatedAt, changedAt, CreatedAt }, flag.Environments.Select(item => item.UpdatedAtUtc));
        Assert.Collection(flag.History.Skip(1),
            description => Assert.Equal(("description", "Old description", null, null),
                (description.Field, description.OldValue, description.NewValue, description.Environment)),
            enabled => Assert.Equal(("enabled", "true", "false", FlagEnvironment.Staging),
                (enabled.Field, enabled.OldValue, enabled.NewValue, enabled.Environment)),
            rollout => Assert.Equal(("rolloutPercentage", "80", "0", FlagEnvironment.Staging),
                (rollout.Field, rollout.OldValue, rollout.NewValue, rollout.Environment)));
    }

    private static void AssertSettings(FlagEnvironmentSettings settings, FlagEnvironment environment,
        bool enabled, int rollout) =>
        Assert.Equal((environment, enabled, rollout, CreatedAt),
            (settings.Environment, settings.Enabled, settings.RolloutPercentage, settings.UpdatedAtUtc));
}
