using System.Text.RegularExpressions;

namespace Rollout.Api.Flags;

internal static partial class FlagValidation
{
    internal const string EnvironmentError = "Choose Development, Staging or Production.";

    internal static Dictionary<string, string[]> Create(CreateFlagRequest request, out FlagEnvironment environment)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.Key is null || !KeyPattern().IsMatch(request.Key))
            errors["key"] = ["Use one or more Latin letters, digits, hyphens or underscores."];
        if (string.IsNullOrWhiteSpace(request.Name))
            errors["name"] = ["Name is required."];
        if (!TryEnvironment(request.Environment, out environment))
            errors["environment"] = [EnvironmentError];
        if (request.Enabled is null)
            errors["enabled"] = ["Enabled is required."];
        ValidateRollout(request.RolloutPercentage, errors);
        return errors;
    }

    internal static Dictionary<string, string[]> Patch(PatchFlagRequest request, out FlagEnvironment environment)
    {
        var errors = new Dictionary<string, string[]>();
        environment = default;
        if (request.HasKey)
            errors["key"] = ["Key is immutable and must be omitted."];
        if (request.HasName && string.IsNullOrWhiteSpace(request.Name))
            errors["name"] = ["Name is required when supplied."];
        if ((request.HasEnvironment || request.HasEnabled || request.HasRolloutPercentage)
            && !TryEnvironment(request.Environment, out environment))
            errors["environment"] = [EnvironmentError];
        if (request.HasEnabled && request.Enabled is null)
            errors["enabled"] = ["Enabled must be true or false."];
        if (request.HasRolloutPercentage)
            ValidateRollout(request.RolloutPercentage, errors);
        return errors;
    }

    internal static bool TryEnvironment(string? value, out FlagEnvironment environment) =>
        Enum.TryParse(value, out environment) && Enum.IsDefined(environment) && environment.ToString() == value;

    internal static Dictionary<string, string[]> Page(int page, int pageSize)
    {
        var errors = new Dictionary<string, string[]>();
        if (page < 1)
            errors["page"] = ["Page must be at least 1."];
        if (pageSize is < 1 or > 100)
            errors["pageSize"] = ["Page size must be between 1 and 100."];
        return errors;
    }

    private static void ValidateRollout(int? value, Dictionary<string, string[]> errors)
    {
        if (value is null or < 0 or > 100)
            errors["rolloutPercentage"] = ["Rollout percentage must be an integer between 0 and 100."];
    }

    [GeneratedRegex(@"\A[A-Za-z0-9_-]+\z")]
    private static partial Regex KeyPattern();
}
