using System.Text.Json;
using AltV.Net;
using AltV.Net.Elements.Entities;
using FloVMP.Sdk;

namespace Gamemode;

/// <summary>
/// Masson RP — ядро геймода: персонаж (RP-имя), деньги, HUD.
///
/// Поток игрока:
///   flovmp:native:ready → игрок в мире (в личном измерении, пока не выбрал персонажа);
///   flovmp:player:dataLoaded → читаем ключ masson:char из хранилища платформы;
///   клиент сообщает masson:ui:ready → отправляем экран (создание / «с возвращением»);
///   masson:char:create / masson:play → персонаж в мире, HUD.
///
/// Всё состояние — в главном потоке сервера; база (уникальность имён) — асинхронно.
/// </summary>
public sealed class GamemodeResource : Resource
{
    private const string CharKey = "masson:char";
    private const int AuthDimensionBase = 100_000;
    private const long StartCash = 5_000;

    private readonly Dictionary<int, Session> _sessions = new();
    private string _conn = "";

    public override void OnStart()
    {
        FloVAsync.Attach();
        _conn = new FloVMP.Core.Database.DatabaseConfig().BuildConnectionString();

        Alt.OnServer<int, string>("flovmp:native:ready", OnReady);
        Alt.OnServer<IPlayer>("flovmp:player:ready", p => OnReady((int)p.Id, p.Name));
        Alt.OnServer<int, string, string>("flovmp:native:left", (id, _, _) => _sessions.Remove(id));

        Alt.OnServer<int, bool>("flovmp:player:dataLoaded", OnDataLoaded);
        Alt.OnServer<int, string, string, bool>("flovmp:player:data", OnData);

        Alt.OnServer<int, string, string>("flovmp:client:event", OnClientEvent);
        Alt.OnServer<int, string, string, string>("flovmp:native:command", OnCommand);
        Alt.OnServer<IPlayer, string, string>("flovmp:command", (p, cmd, args) => OnCommand((int)p.Id, p.Name, cmd, args));

        Alt.OnServer("flovmp:platform:ready", ConfigurePlatform);
        ConfigurePlatform();

        Alt.Log("[Masson] ядро запущено");
    }

    public override void OnTick() => FloVAsync.Pump();

    public override void OnStop()
    {
        FloVAsync.Stop();
        Alt.Log("[Masson] ядро остановлено");
    }

    private static void ConfigurePlatform()
    {
        Alt.Emit("flovmp:commands:register", "money", "ваши наличные и счёт в банке", 0);
        Alt.Emit("flovmp:commands:register", "pay", "передать наличные: /pay <id> <сумма>", 0);
        Alt.Emit("flovmp:commands:register", "givemoney", "выдать наличные: /givemoney <id> <сумма>", 4);
    }

    // --- Жизненный цикл игрока ------------------------------------------------

    private void OnReady(int id, string nick)
    {
        var s = Get(id);
        s.Nick = nick;
        // Пока персонаж не выбран — в личном измерении: никто не видит «призрака» без имени.
        Alt.Emit("flovmp:native:dimension", id, AuthDimensionBase + id);
        Alt.Emit("flovmp:player:data:get", id, CharKey);
    }

    private void OnDataLoaded(int id, bool ok)
    {
        if (!ok) Alt.LogWarning($"[Masson] данные игрока {id} не загрузились — новый персонаж будет создан заново");
        Alt.Emit("flovmp:player:data:get", id, CharKey);
    }

    private void OnData(int id, string key, string value, bool found)
    {
        if (key != CharKey) return;
        var s = Get(id);
        s.Loaded = true;
        s.Character = found ? Character.Parse(value) : null;
        PushScreen(id);
    }

    private void OnClientEvent(int id, string name, string json)
    {
        switch (name)
        {
            case "masson:ui:ready":
                Get(id).UiReady = true;
                PushScreen(id);
                break;

            case "masson:char:create":
                FloVAsync.Run(ct => CreateCharacterAsync(id, json, ct));
                break;

            case "masson:play":
                var s = Get(id);
                if (s.Character is null || s.InWorld) return;
                EnterWorld(id, s);
                break;
        }
    }

    /// <summary>Экран для игрока: ждём и данные, и загруженную страницу.</summary>
    private void PushScreen(int id)
    {
        var s = Get(id);
        if (!s.Loaded || !s.UiReady || s.InWorld) return;
        if (s.Character is null)
            Call(id, "masson:screen", "create", "");
        else
            Call(id, "masson:screen", "welcome", s.Character.FullName);
    }

    // --- Создание персонажа ---------------------------------------------------

    private async Task CreateCharacterAsync(int id, string json, CancellationToken ct)
    {
        var s = Get(id);
        if (s.Character is not null || s.Creating) return;

        string[]? args;
        try { args = JsonSerializer.Deserialize<string[]>(json); }
        catch (JsonException) { return; }
        if (args is not { Length: 3 }) return;

        var first = NameRules.Normalize(args[0]);
        var last = NameRules.Normalize(args[1]);
        var sex = args[2] == "f" ? "f" : "m";

        if (NameRules.Check(first) is { } e1) { Call(id, "masson:error", "first", e1); return; }
        if (NameRules.Check(last) is { } e2) { Call(id, "masson:error", "last", e2); return; }

        s.Creating = true;
        try
        {
            bool reserved;
            await using (var db = new MySqlConnector.MySqlConnection(_conn))
            {
                await db.OpenAsync(ct);
                await using var cmd = db.CreateCommand();
                cmd.CommandText = "INSERT IGNORE INTO masson_names (first_name, last_name) VALUES (@f, @l)";
                cmd.Parameters.AddWithValue("@f", first);
                cmd.Parameters.AddWithValue("@l", last);
                reserved = await cmd.ExecuteNonQueryAsync(ct) == 1;
            }
            // После await — снова главный поток: игрок мог выйти.
            if (!_sessions.ContainsKey(id)) return;
            if (!reserved)
            {
                Call(id, "masson:error", "first", "Это имя уже занято. Выберите другое имя или фамилию.");
                return;
            }

            s.Character = new Character
            {
                First = first, Last = last, Sex = sex,
                Cash = StartCash, Bank = 0,
                CreatedUtc = DateTime.UtcNow,
            };
            Save(id, s);
            Alt.Log($"[Masson] новый персонаж {s.Character.FullName} (игрок {id}, {s.Nick})");
            EnterWorld(id, s);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Alt.LogError($"[Masson] создание персонажа игрока {id}: {ex.Message}");
            Call(id, "masson:error", "first", "Сервер не смог сохранить персонажа. Попробуйте ещё раз через минуту.");
        }
        finally { s.Creating = false; }
    }

    private void EnterWorld(int id, Session s)
    {
        var c = s.Character!;
        s.InWorld = true;
        Alt.Emit("flovmp:native:model", id, c.Sex == "f" ? "a_f_y_business_01" : "a_m_y_business_01");
        Alt.Emit("flovmp:native:dimension", id, 0);
        Alt.Emit("flovmp:player:setVariable", id, "masson:name", JsonSerializer.Serialize(c.FullName));
        PushMoney(id, c);
        Call(id, "masson:screen", "hud", c.FullName);
        SendChat(id, $"{{ff2e93}}[Masson RP]{{ffffff}} Добро пожаловать, {c.FullName}! Команды: /money, /pay");
    }

    // --- Деньги ----------------------------------------------------------------

    private void OnCommand(int id, string nick, string command, string args)
    {
        var s = Get(id);
        switch (command)
        {
            case "money":
                if (s.Character is not { } c) { SendChat(id, "Сначала создайте персонажа."); return; }
                SendChat(id, $"{{ff2e93}}[Деньги]{{ffffff}} Наличные: {Money(c.Cash)} · Банк: {Money(c.Bank)}");
                break;

            case "pay":
                Pay(id, s, args);
                break;

            case "givemoney":
                GiveMoney(id, nick, args);
                break;
        }
    }

    private void Pay(int id, Session s, string args)
    {
        if (s.Character is not { } from || !s.InWorld) { SendChat(id, "Сначала войдите в игру персонажем."); return; }
        if (!TryTargetAndSum(args, out var targetId, out var sum)) { SendChat(id, "Использование: /pay <id> <сумма>"); return; }
        if (targetId == id) { SendChat(id, "Нельзя передать деньги самому себе."); return; }
        if (!_sessions.TryGetValue(targetId, out var t) || t.Character is not { } to || !t.InWorld)
        { SendChat(id, $"Игрок {targetId} не в игре."); return; }
        if (from.Cash < sum) { SendChat(id, $"Не хватает наличных: у вас {Money(from.Cash)}."); return; }

        from.Cash -= sum;
        to.Cash += sum;
        Save(id, s); Save(targetId, t);
        PushMoney(id, from); PushMoney(targetId, to);
        Notify(id, $"Вы передали {Money(sum)} — {to.FullName}");
        Notify(targetId, $"{from.FullName} передал вам {Money(sum)}");
        Alt.Log($"[Masson] pay {from.FullName} → {to.FullName}: {sum}");
    }

    private void GiveMoney(int id, string nick, string args)
    {
        // Уровень (4+) проверила платформа при регистрации команды.
        if (!TryTargetAndSum(args, out var targetId, out var sum)) { SendChat(id, "Использование: /givemoney <id> <сумма>"); return; }
        if (!_sessions.TryGetValue(targetId, out var t) || t.Character is not { } to)
        { SendChat(id, $"У игрока {targetId} нет персонажа."); return; }
        to.Cash += sum;
        Save(targetId, t);
        PushMoney(targetId, to);
        Notify(targetId, $"Администрация выдала вам {Money(sum)}");
        SendChat(id, $"Выдано {Money(sum)} — {to.FullName} (ID {targetId}).");
        Alt.Log($"[Masson] givemoney {nick} → {to.FullName}: {sum}");
    }

    private static bool TryTargetAndSum(string args, out int targetId, out long sum)
    {
        sum = 0; targetId = 0;
        var p = args.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return p.Length == 2 && int.TryParse(p[0], out targetId)
            && long.TryParse(p[1], out sum) && sum is > 0 and <= 10_000_000;
    }

    private static void PushMoney(int id, Character c)
    {
        Alt.Emit("flovmp:player:setOwnVariable", id, "masson:cash", c.Cash.ToString());
        Alt.Emit("flovmp:player:setOwnVariable", id, "masson:bank", c.Bank.ToString());
    }

    // --- Вспомогательное ---------------------------------------------------------

    private Session Get(int id)
    {
        if (!_sessions.TryGetValue(id, out var s)) _sessions[id] = s = new Session();
        return s;
    }

    private static void Save(int id, Session s)
    {
        if (s.Character is null) return;
        Alt.Emit("flovmp:player:data:set", id, CharKey, s.Character.ToJson());
        Alt.Emit("flovmp:player:save", id);
    }

    private static void Call(int id, string ev, params string[] args) =>
        Alt.Emit("flovmp:client:call", id, ev, JsonSerializer.Serialize(args));

    private static void Notify(int id, string text) => Call(id, "masson:notify", text);

    private static string Money(long v) => "$" + v.ToString("N0", System.Globalization.CultureInfo.GetCultureInfo("ru-RU"));

    public static void SendChat(int playerId, string text) => Alt.Emit("flovmp:chat:to", playerId, text);

    private sealed class Session
    {
        public string Nick = "";
        public bool Loaded, UiReady, InWorld, Creating;
        public Character? Character;
    }
}
