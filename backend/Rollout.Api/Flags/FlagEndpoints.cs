using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Rollout.Api.Flags;

internal static class FlagEndpoints
{
    internal static void MapFlags(this WebApplication app)
    {
        var flags = app.MapGroup("/api/flags").WithTags("Flags");
        flags.MapGet("", List).WithName("ListFlags");
        flags.MapGet("/{id}", Get).WithName("GetFlag").ProducesProblem(400).ProducesProblem(404);
        flags.MapPost("", Create).WithName("CreateFlag").ProducesProblem(409);
        flags.MapPatch("/{id}", Patch).WithName("UpdateFlag").ProducesProblem(404);
        flags.MapGet("/{id}/history", History).WithName("GetFlagHistory").ProducesProblem(404);
    }

    private static async Task<Results<Ok<PageResponse<FlagListItem>>, ValidationProblem>> List(
        FlagsDbContext db, CancellationToken cancellationToken,
        string environment = "Development", string? search = null, string? enabled = null,
        int page = 1, int pageSize = 20)
    {
        var errors = FlagValidation.Page(page, pageSize);
        if (!FlagValidation.TryEnvironment(environment, out var selected))
            errors["environment"] = [FlagValidation.EnvironmentError];

        bool? status = null;
        if (!string.IsNullOrEmpty(enabled))
        {
            if (bool.TryParse(enabled, out var parsed))
                status = parsed;
            else
                errors["enabled"] = ["Enabled must be true or false."];
        }
        if (errors.Count > 0)
            return TypedResults.ValidationProblem(errors);

        var query = db.EnvironmentSettings.AsNoTracking().Where(settings => settings.Environment == selected);
        if (status is { } filter)
            query = query.Where(settings => settings.Enabled == filter);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            var pattern = $"%{term}%";
            query = query.Where(settings =>
                EF.Functions.Like(settings.Flag.Name, pattern, "\\")
                || EF.Functions.Like(settings.Flag.Key, pattern, "\\"));
        }

        var items = query.OrderBy(settings => settings.Flag.Key).Select(settings => new FlagListItem(
            settings.FeatureFlagId, settings.Flag.Key, settings.Flag.Name, settings.Flag.Description,
            settings.Environment, settings.Enabled, settings.RolloutPercentage,
            settings.UpdatedAtUtc > settings.Flag.UpdatedAtUtc ? settings.UpdatedAtUtc : settings.Flag.UpdatedAtUtc));
        return TypedResults.Ok(await ReadPage(items, page, pageSize, cancellationToken));
    }

    private static async Task<Results<Ok<FlagResponse>, ProblemHttpResult>> Get(
        Guid id, FlagsDbContext db, CancellationToken cancellationToken)
    {
        var flag = await db.Flags.AsNoTracking().Include(item => item.Environments)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return flag is null ? MissingFlag() : TypedResults.Ok(flag.ToResponse());
    }

    private static async Task<Results<CreatedAtRoute<FlagResponse>, ValidationProblem, ProblemHttpResult>> Create(
        CreateFlagRequest request, FlagsDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var errors = FlagValidation.Create(request, out var environment);
        if (errors.Count > 0)
            return TypedResults.ValidationProblem(errors);

        var flag = FeatureFlag.Create(request.Key!, request.Name!, request.Description, environment,
            request.Enabled!.Value, request.RolloutPercentage!.Value, clock.GetUtcNow().UtcDateTime);
        db.Flags.Add(flag);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is SqliteException
        { SqliteExtendedErrorCode: 2067 })
        {
            // SQLITE_CONSTRAINT_UNIQUE covers collisions regardless of concurrent requests.
            return TypedResults.Problem(detail: "A flag with this key already exists.",
                statusCode: StatusCodes.Status409Conflict);
        }
        return TypedResults.CreatedAtRoute(flag.ToResponse(), "GetFlag", new { id = flag.Id });
    }

    private static async Task<Results<Ok<FlagResponse>, ValidationProblem, ProblemHttpResult>> Patch(
        Guid id, PatchFlagRequest request, FlagsDbContext db, TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var errors = FlagValidation.Patch(request, out var environment);
        if (errors.Count > 0)
            return TypedResults.ValidationProblem(errors);

        // Serialize SQLite writers from the read so audit old values reflect the previous committed state.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var flag = await db.Flags.Include(item => item.Environments)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (flag is null)
            return MissingFlag();

        if (flag.Apply(request, environment, clock.GetUtcNow().UtcDateTime))
            await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return TypedResults.Ok(flag.ToResponse());
    }

    private static async Task<Results<Ok<PageResponse<FlagAuditItem>>, ValidationProblem, ProblemHttpResult>> History(
        Guid id, FlagsDbContext db, CancellationToken cancellationToken, int page = 1, int pageSize = 20)
    {
        var errors = FlagValidation.Page(page, pageSize);
        if (errors.Count > 0)
            return TypedResults.ValidationProblem(errors);

        if (!await db.Flags.AnyAsync(flag => flag.Id == id, cancellationToken))
            return MissingFlag();

        var items = db.AuditEvents.AsNoTracking().Where(entry => entry.FeatureFlagId == id)
            .OrderByDescending(entry => entry.ChangedAtUtc).ThenBy(entry => entry.Id)
            .Select(entry => new FlagAuditItem(entry.Id, entry.FeatureFlagId, entry.Environment,
                entry.Field, entry.OldValue, entry.NewValue, entry.Actor, entry.ChangedAtUtc));
        return TypedResults.Ok(await ReadPage(items, page, pageSize, cancellationToken));
    }

    private static async Task<PageResponse<T>> ReadPage<T>(
        IQueryable<T> query, int page, int pageSize, CancellationToken cancellationToken)
    {
        var totalCount = await query.CountAsync(cancellationToken);
        var offset = (long)(page - 1) * pageSize;
        var items = offset >= totalCount
            ? []
            : await query.Skip((int)offset).Take(pageSize).ToListAsync(cancellationToken);
        return new(items, totalCount, page, pageSize);
    }

    private static ProblemHttpResult MissingFlag() =>
        TypedResults.Problem(detail: "Flag was not found.", statusCode: StatusCodes.Status404NotFound);
}
