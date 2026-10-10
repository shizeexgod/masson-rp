using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Gamemode;

/// <summary>Персонаж игрока. Хранится JSON-строкой в хранилище платформы (player_data, ключ masson:char).</summary>
public sealed class Character
{
    [JsonPropertyName("v")] public int Version { get; set; } = 1;
    [JsonPropertyName("first")] public string First { get; set; } = "";
    [JsonPropertyName("last")] public string Last { get; set; } = "";
    [JsonPropertyName("sex")] public string Sex { get; set; } = "m";
    [JsonPropertyName("cash")] public long Cash { get; set; }
    [JsonPropertyName("bank")] public long Bank { get; set; }
    [JsonPropertyName("created")] public DateTime CreatedUtc { get; set; }

    [JsonIgnore] public string FullName => $"{First} {Last}";

    public string ToJson() => JsonSerializer.Serialize(this);

    /// <summary>null — запись повреждена (тогда игрок создаёт персонажа заново, в журнал — предупреждение).</summary>
    public static Character? Parse(string json)
    {
        try
        {
            var c = JsonSerializer.Deserialize<Character>(json);
            return c is { First.Length: > 0, Last.Length: > 0 } ? c : null;
        }
        catch (JsonException)
        {
            AltV.Net.Alt.LogWarning("[Masson] повреждённая запись персонажа — будет создан новый");
            return null;
        }
    }
}

/// <summary>Правила RP-имени: латиница, с заглавной буквы, 2–16 символов.</summary>
public static partial class NameRules
{
    [GeneratedRegex("^[A-Z][a-z]{1,15}$")]
    private static partial Regex Pattern();

    /// <summary>«  iVAN » → «Ivan».</summary>
    public static string Normalize(string? raw)
    {
        var s = (raw ?? "").Trim();
        return s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..].ToLowerInvariant();
    }

    /// <summary>Текст ошибки для игрока или null, если имя подходит.</summary>
    public static string? Check(string name) => name switch
    {
        { Length: < 2 } => "Минимум 2 буквы.",
        { Length: > 16 } => "Максимум 16 букв.",
        _ when !Pattern().IsMatch(name) => "Только латинские буквы, например Ivan.",
        _ => null,
    };
}
