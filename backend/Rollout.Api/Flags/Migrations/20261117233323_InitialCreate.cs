using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rollout.Api.Flags.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Flags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Key = table.Column<string>(type: "TEXT", nullable: false, collation: "NOCASE"),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Flags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FlagAuditEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FeatureFlagId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Environment = table.Column<string>(type: "TEXT", nullable: true),
                    Field = table.Column<string>(type: "TEXT", nullable: false),
                    OldValue = table.Column<string>(type: "TEXT", nullable: true),
                    NewValue = table.Column<string>(type: "TEXT", nullable: true),
                    Actor = table.Column<string>(type: "TEXT", nullable: false),
                    ChangedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlagAuditEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FlagAuditEvents_Flags_FeatureFlagId",
                        column: x => x.FeatureFlagId,
                        principalTable: "Flags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FlagEnvironmentSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FeatureFlagId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Environment = table.Column<string>(type: "TEXT", nullable: false),
                    Enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    RolloutPercentage = table.Column<int>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlagEnvironmentSettings", x => x.Id);
                    table.CheckConstraint("CK_FlagEnvironmentSettings_Rollout", "\"RolloutPercentage\" BETWEEN 0 AND 100");
                    table.ForeignKey(
                        name: "FK_FlagEnvironmentSettings_Flags_FeatureFlagId",
                        column: x => x.FeatureFlagId,
                        principalTable: "Flags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FlagAuditEvents_FeatureFlagId_ChangedAtUtc_Id",
                table: "FlagAuditEvents",
                columns: new[] { "FeatureFlagId", "ChangedAtUtc", "Id" },
                descending: new[] { false, true, false });

            migrationBuilder.CreateIndex(
                name: "IX_FlagEnvironmentSettings_FeatureFlagId_Environment",
                table: "FlagEnvironmentSettings",
                columns: new[] { "FeatureFlagId", "Environment" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Flags_Key",
                table: "Flags",
                column: "Key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FlagAuditEvents");

            migrationBuilder.DropTable(
                name: "FlagEnvironmentSettings");

            migrationBuilder.DropTable(
                name: "Flags");
        }
    }
}
