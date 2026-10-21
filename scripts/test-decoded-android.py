"""Verify the signed release's image bounds on an ephemeral Android emulator."""
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = "com.tryjesusmedia.journey"
REPORTS = Path("android-layout-report")
REPORTS.mkdir(exist_ok=True)


def adb(*args):
    return subprocess.check_output(["adb", *args], timeout=40)


def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/decoded-layout.xml")
    return list(ET.fromstring(adb("exec-out", "cat", "/sdcard/decoded-layout.xml")).iter("node"))


def bounds(node):
    return tuple(map(int, re.findall(r"\d+", node.attrib["bounds"])))


def tap(node):
    left, top, right, bottom = bounds(node)
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def label(node):
    return " ".join((node.get("text", "") + " " + node.get("content-desc", "")).split())


adb("install", "-r", "universal.apk")
for width, scale in [(390, "1.0"), (320, "1.0"), (390, "1.3")]:
    physical_width = width * 2
    name = f"decoded-{width}-font-{scale}"
    adb("shell", "wm", "size", f"{physical_width}x1688")
    adb("shell", "wm", "density", "320")
    adb("shell", "settings", "put", "system", "font_scale", scale)
    adb("shell", "am", "force-stop", PACKAGE)
    adb("shell", "am", "start", "-n", f"{PACKAGE}/.MainActivity")
    image = None
    for attempt in range(15):
        time.sleep(1)
        current = nodes()
        image = next((n for n in current if n.get("content-desc", "").startswith("Bible Decoded: six-part video series.")), None)
        if image is not None:
            break
        permission = next((n for n in current if label(n).lower() in ["don't allow", "do not allow", "not now"]), None)
        if permission is not None:
            tap(permission)
            continue
        tab = next((n for n in current if "Bible" in label(n) and "Decoded" in label(n) and "six-part" not in label(n) and bounds(n)[1] > 1000), None)
        if tab is not None:
            tap(tab)
    (REPORTS / f"{name}.png").write_bytes(adb("exec-out", "screencap", "-p"))
    (REPORTS / f"{name}.xml").write_bytes(adb("exec-out", "cat", "/sdcard/decoded-layout.xml"))
    assert image is not None, f"Bible Decoded graphic did not appear at {width}dp"
    left, top, right, bottom = bounds(image)
    actual_width, actual_height = right - left, bottom - top
    expected_width = physical_width - 2 * 24 * 2
    assert left >= 0 and right <= physical_width, f"Image exceeds screen width: {bounds(image)}"
    assert abs(actual_width - expected_width) <= 4, f"Graphic does not span content width: {actual_width} vs {expected_width}"
    assert abs(actual_height - actual_width * 941 / 1672) <= 4, f"Image is stretched or cropped: {actual_width}x{actual_height}"
    assert top > 0 and bottom < 1500, f"Graphic is not fully visible below the heading: {bounds(image)}"
    print(f"PASS {name}: full graphic within native Android bounds {bounds(image)}", flush=True)
