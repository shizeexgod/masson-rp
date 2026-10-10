"""Прогон серверной части входа RedAge по протоколу клиента: вход -> регистрация -> повторный вход."""
import sys, time, json
sys.path.insert(0, r"C:/FloV-MP/dist/source/flovmp-source-1.0.22/native/legacy-3889/client/tools")
import bot as botmod

HOST, PORT = "176.194.154.89", 7798
LOGIN, PASSWORD, EMAIL = "masson_bot1", "Mx7!test-pass-91", "masson_bot1@example.com"

b = botmod.Bot(HOST, PORT, "MassonFlow", key_path=r"%s/flow.key" % sys.argv[1], log=lambda s: None)
b.connect()
b.send("READY")
time.sleep(4)

def show(title, since=0, only=None):
    print("---", title)
    for m in b.messages[since:]:
        if m[0] in ("PSTATE", "PONG", "CFG", "CMDS", "CMDI", "LIC", "PJOIN", "VADD", "WBLIP", "WMARK", "WLABEL", "WOBJ"):
            continue
        s = " | ".join(m)
        if only and not any(k in s for k in only):
            continue
        print("  ", s[:220])

show("после READY (что прислал сервер)", 0)
n = len(b.messages)
b.send("CEVS", "signup", json.dumps([LOGIN, PASSWORD, EMAIL, ""]))
time.sleep(6)
show("ответ на signup", n)
n = len(b.messages)
b.send("CEVS", "signin", json.dumps([LOGIN, PASSWORD]))
time.sleep(6)
show("ответ на signin", n)
b.close()
