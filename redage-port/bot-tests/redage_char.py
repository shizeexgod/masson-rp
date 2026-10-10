import sys, time, json
sys.path.insert(0, r"C:/FloV-MP/dist/source/flovmp-source-1.0.22/native/legacy-3889/client/tools")
import bot as botmod
HOST, PORT = "176.194.154.89", 7798
LOGIN, PASSWORD = "masson_bot1", "Mx7!test-pass-91"
NOISE = ("PSTATE","PONG","CFG","CMDS","CMDI","LIC","PJOIN","VADD","WBLIP","WMARKER","WLABEL","WOBJ","KEYS","VCLASSQ","SVAR","VVAR","WDATA","WSHAPE","WPED","WPICK","WCOL","WDUMMY","VNPL","VPROP","VCOLOR","VMODS")
b = botmod.Bot(HOST, PORT, "MassonFlow2", key_path=r"%s/flow.key" % sys.argv[1], log=lambda s: None)  # тот же ключ = тот же SocialClub
b.connect(); b.send("READY"); time.sleep(5)

def show(title, since):
    print("---", title)
    for m in b.messages[since:]:
        if m[0] in NOISE: continue
        print("  ", (" | ".join(m))[:230])

n = len(b.messages)
b.send("CEVS", "signin", json.dumps([LOGIN, PASSWORD])); time.sleep(6)
show("signin", n)

n = len(b.messages)
featur = json.dumps([0.0] * 20)
appearance = json.dumps([{"Value": 255, "Opacity": 1.0, "Color": 0}] * 8)
hair = json.dumps([0] * 9)
clothes = json.dumps([{"Drawable": -1, "Texture": 0}] * 4)
b.send("CEVS", "CreateCharacter", json.dumps([0, "Masson", "Botov", True, 0, 0, 0.5, 0.5, featur, appearance, hair, clothes]))
time.sleep(10)
show("CreateCharacter", n)
print("spawn:", b.spawn, "alive:", b.alive)
b.close()
