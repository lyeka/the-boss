"""Exercise the packaged QA app through MyGo's opt-in automation socket (macOS).
Build: THE_BOSS_QA=1 npm run desktop:build -- -debug -skip-dmg -o build/qa
Run: python3 scripts/desktop-smoke.py
The .qa bundle identifier keeps these games separate from the real app.
"""
import base64
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[1]
binary = root / "build/qa/darwin-arm64/我是大老板 QA.app/Contents/MacOS/我是大老板 QA"
sock_path = str(Path(tempfile.gettempdir()) / f"the-boss-qa-{os.getpid()}.sock")
app = None

def rpc(method, **params):
    with socket.socket(socket.AF_UNIX) as s:
        s.settimeout(15)
        s.connect(sock_path)
        s.sendall((json.dumps({"id": 1, "method": method, "params": params}) + "\n").encode())
        result = json.loads(s.makefile("rb").readline())
    if "error" in result:
        raise RuntimeError(result["error"])
    return result["result"]

def js(script):
    return rpc("eval", script=script)["value"]

def wait_for(script):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        try:
            value = js(script)
            if value:
                return value
        except (OSError, RuntimeError):
            pass
        time.sleep(.2)
    raise AssertionError(f"Timed out: {script}")

def start():
    global app
    app = subprocess.Popen([str(binary)], env={**os.environ, "MYGO_AUTOMATION": sock_path},
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    wait_for("document.querySelector('button') !== null")

def close():
    js("setTimeout(() => window.mygo.window.close(), 100); true")
    app.wait(timeout=10)

try:
    start()
    assert js("location.href") == "mygo://localhost/"
    # Reset only the isolated QA app to make the test repeatable.
    js("localStorage.removeItem('the-boss.save.v1'); location.reload(); true")
    wait_for("[...document.querySelectorAll('button')].some(b => b.textContent.includes('请各位老板入座'))")
    assert js("[...document.images].every(i => i.complete && i.naturalWidth > 0)")
    assert js("document.documentElement.scrollWidth <= innerWidth")
    assert js("!!window.AudioContext")
    js("[...document.querySelectorAll('button')].find(b => b.textContent.includes('请各位老板入座')).click(); true")
    wait_for("localStorage.getItem('the-boss.save.v1')")
    js("document.querySelector('[aria-label=\"暂停电脑行动\"]')?.click(); true")
    state = json.loads(js("localStorage.getItem('the-boss.save.v1')"))
    assert len(state["players"]) == 4
    invalid = js("window.mygo.call('Desktop.ExportSave', 'bad.json', 'bad').then(() => false, () => true)")
    assert invalid, "native bridge must reject invalid JSON"
    saved = js("localStorage.getItem('the-boss.save.v1')")
    capture = rpc("capture")
    (root / "build/qa/client-smoke.png").write_bytes(base64.b64decode(capture["png"]))
    close()
    start()
    wait_for("document.querySelector('[aria-label=\"隐私交接\"]') !== null")
    assert js("localStorage.getItem('the-boss.save.v1')") == saved, "saved game changed across restart"
    assert js("[...document.images].every(i => i.complete && i.naturalWidth > 0)")
    close()
    print("PASS: embedded offline frontend, assets, layout, audio API, new game, native bridge validation, save persistence, privacy gate")
finally:
    if app is not None and app.poll() is None:
        app.terminate()
        app.wait(timeout=10)
