using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Rollout.Api.Flags;

namespace Rollout.Tests;

public sealed class FlagApiTests : IDisposable
{
    private const string FlagsUrl = "/api/flags";
    private readonly DirectoryInfo directory = Directory.CreateTempSubdirectory("rollout-tests-");

    [Fact]
    public async Task Create_returns_details_and_data_survives_restart()
    {
        Guid id;
        using (var app = CreateApp())
        using (var client = app.CreateClient())
        {
            var flag = await CreateFlag(client, "New-Checkout", "Checkout", "Staging", true, 40);
            id = flag.Id;
            Assert.Equal("New-Checkout", flag.Key);
            Assert.Equal(DateTimeKind.Utc, flag.CreatedAtUtc.Kind);
            Assert.Collection(flag.Environments,
                development => Assert.Equal((FlagEnvironment.Development, false, 0),
                    (development.Environment, development.Enabled, development.RolloutPercentage)),
                staging => Assert.Equal((FlagEnvironment.Staging, true, 40),
                    (staging.Environment, staging.Enabled, staging.RolloutPercentage)),
                production => Assert.Equal((FlagEnvironment.Production, false, 0),
                    (production.Environment, production.Enabled, production.RolloutPercentage)));
        }

        using var restarted = CreateApp();
        using var restartedClient = restarted.CreateClient();
        var saved = await restartedClient.GetFromJsonAsync<FlagResponse>($"{FlagsUrl}/{id}");
        Assert.NotNull(saved);
        Assert.Equal(("New-Checkout", "Checkout"), (saved.Key, saved.Name));
        Assert.True(saved.Environments[1].Enabled);
        Assert.Equal(40, saved.Environments[1].RolloutPercentage);
        var history = await GetHistory(restartedClient, id);
        var created = Assert.Single(history.Items);
        Assert.Equal(1, history.TotalCount);
        Assert.Equal((id, "created", null, "New-Checkout", "demo-user", saved.CreatedAtUtc),
            (created.FeatureFlagId, created.Field, created.OldValue, created.NewValue, created.Actor,
                created.ChangedAtUtc));
        Assert.Null(created.Environment);
        Assert.Equal(DateTimeKind.Utc, created.ChangedAtUtc.Kind);
    }

    [Fact]
    public async Task Duplicate_key_ignores_case_and_conflict_does_not_save_partial_data()
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        var flag = await CreateFlag(client, "New-Checkout", "Checkout", "Development", true, 100);
        using var conflict = await client.PostAsJsonAsync(FlagsUrl,
            new CreateFlagRequest("new-checkout", "Duplicate", null, "Staging", true, 50));

        using var problem = await AssertProblem(conflict, HttpStatusCode.Conflict);
        var page = await client.GetFromJsonAsync<PageResponse<FlagListItem>>(FlagsUrl);
        Assert.Equal(flag.Id, Assert.Single(page!.Items).Id);
        Assert.Equal(1, page.TotalCount);
        Assert.Single((await GetHistory(client, flag.Id)).Items);
    }

    [Fact]
    public async Task Patch_clears_description_audits_false_and_zero_and_preserves_other_settings()
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        var flag = await CreateFlag(client, "checkout", "Checkout", "Production", true, 65);
        var path = $"{FlagsUrl}/{flag.Id}";
        app.Clock.UtcNow = app.Clock.UtcNow.AddMinutes(1);
        var staging = await UpdateFlag(client, path, new { environment = "Staging", enabled = true, rolloutPercentage = 30 });
        Assert.Equal(flag.UpdatedAtUtc, staging.UpdatedAtUtc);
        Assert.Equal(flag.Environments[2], staging.Environments[2]);

        app.Clock.UtcNow = app.Clock.UtcNow.AddMinutes(1);
        var body = new { description = (string?)null, environment = "Production", enabled = false, rolloutPercentage = 0 };
        var updated = await UpdateFlag(client, path, body);
        Assert.Equal((flag.Key, flag.Name, flag.CreatedAtUtc), (updated.Key, updated.Name, updated.CreatedAtUtc));
        Assert.Null(updated.Description);
        Assert.Equal(app.Clock.UtcNow.UtcDateTime, updated.UpdatedAtUtc);
        Assert.Equal(staging.Environments[1], updated.Environments[1]);
        Assert.Equal((false, 0, updated.UpdatedAtUtc),
            (updated.Environments[2].Enabled, updated.Environments[2].RolloutPercentage, updated.Environments[2].UpdatedAtUtc));

        var history = await GetHistory(client, flag.Id);
        Assert.Equal(6, history.TotalCount);
        Assert.Equal(new[] { "description", "enabled", "rolloutPercentage" },
            history.Items.Take(3).Select(item => item.Field).Order());
        Assert.All(history.Items, audit => Assert.Equal("demo-user", audit.Actor));
        Assert.Equal((null, "Example description", null), Values("description"));
        Assert.Equal((FlagEnvironment.Production, "true", "false"), Values("enabled"));
        Assert.Equal((FlagEnvironment.Production, "65", "0"), Values("rolloutPercentage"));

        app.Clock.UtcNow = app.Clock.UtcNow.AddMinutes(1);
        var repeated = await UpdateFlag(client, path, body);
        Assert.Equal(updated.UpdatedAtUtc, repeated.UpdatedAtUtc);
        Assert.Equal(updated.Environments, repeated.Environments);
        Assert.Equal(history.Items, (await GetHistory(client, flag.Id)).Items);
        var historyPage = await GetHistory(client, flag.Id, "?page=2&pageSize=2");
        Assert.Equal(history.Items.Skip(2).Take(2), historyPage.Items);
        var pastHistory = await GetHistory(client, flag.Id, "?page=4&pageSize=2");
        Assert.Empty(pastHistory.Items);
        Assert.Equal(6, pastHistory.TotalCount);

        (FlagEnvironment?, string?, string?) Values(string field)
        {
            var entry = Assert.Single(history.Items.Take(3), item => item.Field == field);
            Assert.Equal(updated.UpdatedAtUtc, entry.ChangedAtUtc);
            return (entry.Environment, entry.OldValue, entry.NewValue);
        }
    }

    [Fact]
    public async Task List_filters_before_counting_and_keeps_stable_key_order()
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        await CreateFlag(client, "z-checkout", "One", "Staging", true, 20);
        await CreateFlag(client, "a-flag", "CHECKOUT", "Staging", true, 0);
        await CreateFlag(client, "b-checkout", "Two", "Development", true, 10);
        await CreateFlag(client, "checkout-disabled", "Three", "Staging", false, 80);
        await CreateFlag(client, "unrelated", "Новый экран — 25%", "Staging", true, 20);

        const string url = $"{FlagsUrl}?environment=Staging&search=checkout&enabled=true&pageSize=1";
        var first = await client.GetFromJsonAsync<PageResponse<FlagListItem>>(url);
        Assert.Equal((2, 1, 1), (first!.TotalCount, first.Page, first.PageSize));
        var item = Assert.Single(first.Items);
        Assert.Equal(("a-flag", FlagEnvironment.Staging, true, 0),
            (item.Key, item.Environment, item.Enabled, item.RolloutPercentage));
        var second = await client.GetFromJsonAsync<PageResponse<FlagListItem>>(url + "&page=2");
        Assert.Equal("z-checkout", Assert.Single(second!.Items).Key);
        var past = await client.GetFromJsonAsync<PageResponse<FlagListItem>>(url + "&page=2147483647");
        Assert.Empty(past!.Items);
        Assert.Equal(2, past.TotalCount);
        var empty = await client.GetFromJsonAsync<PageResponse<FlagListItem>>($"{FlagsUrl}?search=missing");
        Assert.Empty(empty!.Items);
        Assert.Equal(0, empty.TotalCount);
        var literal = await client.GetFromJsonAsync<PageResponse<FlagListItem>>(
            $"{FlagsUrl}?environment=Staging&search={Uri.EscapeDataString("Новый экран — 25%")}");
        Assert.Equal("unrelated", Assert.Single(literal!.Items).Key);
    }

    [Theory]
    [InlineData("name", "null")]
    [InlineData("name", "\" \"")]
    [InlineData("description", "42")]
    [InlineData("environment", "null")]
    [InlineData("environment", "\"2\"")]
    [InlineData("environment", "\"42\"")]
    [InlineData("key", "\"renamed\"")]
    [InlineData("enabled", "null")]
    [InlineData("enabled", "false")]
    [InlineData("rolloutPercentage", "null")]
    [InlineData("rolloutPercentage", "101")]
    public async Task Patch_returns_problem_details_on_invalid_input(string field, string value)
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        var flag = await CreateFlag(client, "checkout", "Checkout", "Development", true, 100);
        var body = field == "rolloutPercentage" || (field == "enabled" && value == "null")
            ? $"{{\"environment\":\"Development\",\"{field}\":{value}}}"
            : $"{{\"{field}\":{value}}}";
        using var response = await client.PatchAsync($"{FlagsUrl}/{flag.Id}",
            new StringContent(body, Encoding.UTF8, "application/json"));
        using var problem = await AssertProblem(response, HttpStatusCode.BadRequest);
        if (field != "description")
            Assert.True(problem.RootElement.GetProperty("errors").TryGetProperty(
                value == "false" ? "environment" : field, out _));
        Assert.Single((await GetHistory(client, flag.Id)).Items);
    }

    [Fact]
    public async Task Create_validates_all_required_fields()
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        using var response = await client.PostAsJsonAsync(FlagsUrl, new { key = "bad key", rolloutPercentage = -1 });
        using var problem = await AssertProblem(response, HttpStatusCode.BadRequest);
        var errors = problem.RootElement.GetProperty("errors");
        Assert.Equal(new[] { "enabled", "environment", "key", "name", "rolloutPercentage" },
            errors.EnumerateObject().Select(error => error.Name).Order());
    }

    [Theory]
    [InlineData("?page=0", "page")]
    [InlineData("?pageSize=101", "pageSize")]
    [InlineData("?environment=Test", "environment")]
    [InlineData("?enabled=all", "enabled")]
    public async Task List_validates_query_parameters(string query, string field)
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        using var response = await client.GetAsync(FlagsUrl + query);
        using var problem = await AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.True(problem.RootElement.GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Missing_flags_and_invalid_parameters_return_problem_details()
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        var path = $"{FlagsUrl}/{Guid.NewGuid()}";
        using var details = await client.GetAsync(path);
        using var history = await client.GetAsync(path + "/history");
        using var patch = await client.PatchAsJsonAsync(path, new { name = "Unknown" });
        using var invalidPage = await client.GetAsync(path + "/history?pageSize=0");
        using var invalidId = await client.GetAsync($"{FlagsUrl}/invalid");
        using var malformedPage = await client.GetAsync($"{FlagsUrl}?page=invalid");
        using var missingDetails = await AssertProblem(details, HttpStatusCode.NotFound);
        using var missingHistory = await AssertProblem(history, HttpStatusCode.NotFound);
        using var missingPatch = await AssertProblem(patch, HttpStatusCode.NotFound);
        using var badPage = await AssertProblem(invalidPage, HttpStatusCode.BadRequest);
        using var badId = await AssertProblem(invalidId, HttpStatusCode.BadRequest);
        using var badPageFormat = await AssertProblem(malformedPage, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Development_exposes_openapi_and_swagger_ui_with_all_operations()
    {
        using var app = CreateApp();
        using var client = app.CreateClient();
        using var openApi = await client.GetFromJsonAsync<JsonDocument>("/openapi/v1.json");
        var paths = openApi!.RootElement.GetProperty("paths");
        Assert.Equal(new[] { "get", "post" }, Operations(FlagsUrl));
        Assert.Equal(new[] { "get", "patch" }, Operations(FlagsUrl + "/{id}"));
        Assert.Equal(new[] { "get" }, Operations(FlagsUrl + "/{id}/history"));
        var schemas = openApi.RootElement.GetProperty("components").GetProperty("schemas");
        var createFields = schemas.GetProperty("CreateFlagRequest").GetProperty("required").EnumerateArray();
        Assert.DoesNotContain(createFields, element => element.GetString() == "description");
        var patchFields = schemas.GetProperty("PatchFlagRequest").GetProperty("properties");
        Assert.False(patchFields.TryGetProperty("key", out _));
        Assert.Equal("integer", patchFields.GetProperty("rolloutPercentage").GetProperty("type").GetString());
        Assert.Contains("Swagger UI", await client.GetStringAsync("/swagger/index.html"));

        string[] Operations(string path) =>
            paths.GetProperty(path).EnumerateObject().Select(operation => operation.Name).Order().ToArray();
    }

    private static async Task<FlagResponse> CreateFlag(HttpClient client, string key, string name,
        string environment, bool enabled, int rollout)
    {
        using var response = await client.PostAsJsonAsync(FlagsUrl,
            new CreateFlagRequest(key, name, "Example description", environment, enabled, rollout));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var flag = await response.Content.ReadFromJsonAsync<FlagResponse>();
        Assert.NotNull(flag);
        Assert.Equal($"{FlagsUrl}/{flag.Id}", response.Headers.Location?.AbsolutePath);
        return flag;
    }

    private static async Task<FlagResponse> UpdateFlag<T>(HttpClient client, string path, T changes)
    {
        using var response = await client.PatchAsJsonAsync(path, changes);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<FlagResponse>())!;
    }

    private static async Task<PageResponse<FlagAuditItem>> GetHistory(HttpClient client, Guid id, string query = "") =>
        (await client.GetFromJsonAsync<PageResponse<FlagAuditItem>>($"{FlagsUrl}/{id}/history{query}"))!;

    private static async Task<JsonDocument> AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = (await response.Content.ReadFromJsonAsync<JsonDocument>())!;
        Assert.Equal((int)status, problem.RootElement.GetProperty("status").GetInt32());
        return problem;
    }

    private TestApp CreateApp() => new(Path.Combine(directory.FullName, "test.db"));

    public void Dispose() => directory.Delete(recursive: true);

    private sealed class TestApp(string dbPath) : WebApplicationFactory<Program>
    {
        internal TestClock Clock { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("ConnectionStrings:Rollout",
                new SqliteConnectionStringBuilder { DataSource = dbPath, Pooling = false }.ConnectionString);
            builder.ConfigureServices(services => services.AddSingleton<TimeProvider>(Clock));
        }
    }

    private sealed class TestClock : TimeProvider
    {
        internal DateTimeOffset UtcNow { get; set; } = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => UtcNow;
    }
}
