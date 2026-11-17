using System.Text.Json.Nodes;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Rollout.Api.Flags;

internal static class FlagOpenApi
{
    internal static Task DescribeRequest(OpenApiSchema schema, OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        var type = context.JsonTypeInfo.Type;
        if ((type != typeof(CreateFlagRequest) && type != typeof(PatchFlagRequest)) || schema.Properties is null)
            return Task.CompletedTask;

        schema.Required?.Remove("description");
        if (type == typeof(PatchFlagRequest))
        {
            schema.Properties.Remove("key");
            schema.Description = "Omitted fields keep their values. Set description to null to clear it. "
                + "Specify environment when changing enabled or rolloutPercentage. The flag key is immutable.";
        }

        foreach (var (name, property) in schema.Properties)
        {
            if (property is not OpenApiSchema field)
                continue;

            if (name != "description")
                field.Type &= ~JsonSchemaType.Null;
            if (name == "environment")
                field.Enum = Enum.GetNames<FlagEnvironment>().Select(value => (JsonNode)JsonValue.Create(value)).ToList();
        }

        return Task.CompletedTask;
    }
}
