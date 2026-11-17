using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Rollout.Api.Flags;

internal sealed class FlagsDbContext(DbContextOptions<FlagsDbContext> options) : DbContext(options)
{
    internal DbSet<FeatureFlag> Flags => Set<FeatureFlag>();
    internal DbSet<FlagEnvironmentSettings> EnvironmentSettings => Set<FlagEnvironmentSettings>();
    internal DbSet<FlagAuditEvent> AuditEvents => Set<FlagAuditEvent>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder) =>
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        var flags = model.Entity<FeatureFlag>();
        flags.ToTable("Flags");
        flags.Property(flag => flag.Id).ValueGeneratedNever();
        flags.Property(flag => flag.Key).UseCollation("NOCASE");
        flags.HasIndex(flag => flag.Key).IsUnique();
        flags.HasMany(flag => flag.Environments).WithOne(settings => settings.Flag)
            .HasForeignKey(settings => settings.FeatureFlagId);
        flags.HasMany(flag => flag.History).WithOne().HasForeignKey(entry => entry.FeatureFlagId);

        var settings = model.Entity<FlagEnvironmentSettings>();
        settings.Property(item => item.Id).ValueGeneratedNever();
        settings.ToTable("FlagEnvironmentSettings",
            table => table.HasCheckConstraint("CK_FlagEnvironmentSettings_Rollout",
                "\"RolloutPercentage\" BETWEEN 0 AND 100"));
        settings.Property(item => item.Environment).HasConversion<string>();
        settings.HasIndex(item => new { item.FeatureFlagId, item.Environment }).IsUnique();

        var audit = model.Entity<FlagAuditEvent>();
        audit.ToTable("FlagAuditEvents");
        audit.Property(item => item.Id).ValueGeneratedNever();
        audit.Property(item => item.Environment).HasConversion<string>();
        audit.HasIndex(item => new { item.FeatureFlagId, item.ChangedAtUtc, item.Id })
            .IsDescending(false, true, false);
    }

    // SQLite stores timestamp text without its DateTime.Kind.
    private sealed class UtcDateTimeConverter()
        : ValueConverter<DateTime, DateTime>(value => value,
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
