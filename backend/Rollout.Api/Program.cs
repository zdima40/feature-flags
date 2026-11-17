using System.Text.Json.Serialization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Rollout.Api.Flags;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = false);
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.AddOpenApi(options => options.AddSchemaTransformer(FlagOpenApi.DescribeRequest));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<FlagsDbContext>((services, options) =>
{
    var configuration = services.GetRequiredService<IConfiguration>();
    var defaultPath = Path.Combine(builder.Environment.ContentRootPath, "rollout.db");
    var connectionString = configuration.GetConnectionString("Rollout")
        ?? new SqliteConnectionStringBuilder { DataSource = defaultPath }.ConnectionString;
    options.UseSqlite(connectionString);
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "Rollout API v1"));
}

app.MapFlags();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FlagsDbContext>();
    await db.Database.MigrateAsync(app.Lifetime.ApplicationStopping);
}

await app.RunAsync();

public partial class Program;
