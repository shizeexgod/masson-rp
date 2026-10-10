using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using LinqToDB.Configuration;
using LinqToDB.Data;
using Redage.SDK;
using Redage.SDK.Models;

namespace NeptuneEvo.Database
{
    // Masson RP: на FloV:MP скрипты и обработчики ResourceStart могут стартовать раньше,
    // чем конструктор Main успеет зарегистрировать подключения LinqToDB. Регистрируем их
    // при загрузке сборки (то же самое, что делает Main, с теми же настройками mainDB.json).
    internal static class MassonBootstrap
    {
        [ModuleInitializer]
        internal static void Init()
        {
            try
            {
                var mainDB = Settings.ReadAsync("mainDB", new MysqlSettings());
                var list = new List<IConnectionStringSettings>
                {
                    new ConnectionInfo("MainDB", mainDB.Server, mainDB.User, mainDB.Password, mainDB.DataBase),
                    new ConnectionInfo("ConfigDB", mainDB.Server, mainDB.User, mainDB.Password, $"{mainDB.DataBase}config"),
                };
                foreach (var other in mainDB.OtherList)
                    list.Add(new ConnectionInfo(other.Name, other.Server, other.User, other.Password, other.DataBase));
                DataConnection.DefaultSettings = new DatabaseSettings(list.ToArray());
                Note($"bootstrap OK cwd={Environment.CurrentDirectory} host={mainDB.Server} db={mainDB.DataBase} user={mainDB.User}");
            }
            catch (Exception e)
            {
                Note("bootstrap FAIL: " + e);
            }
        }

        internal static void Note(string s)
        {
            try { File.AppendAllText("masson-diag.txt", DateTime.Now.ToString("HH:mm:ss.fff") + " " + s + "\n"); } catch { }
        }
    }
}
