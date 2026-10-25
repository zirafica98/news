"""Glas za Shorts: Kokoro TTS (otvoren kod, Apache 2.0), radi lokalno na procesoru, bez naloga i plaćanja.

Ulaz (stdin, JSON): {"izlaz": "putanja.wav", "glas": "af_heart", "brzina": 1.05, "delovi": ["Prva rečenica.", "Druga."]}
Izlaz (stdout, JSON): {"trajanja": [sekunde po delu, sa pauzom posle dela], "ukupno": sekunde}

Svaki deo se izgovara posebno pa se spajaju sa kratkom pauzom, da bi titlovi u videu tačno pratili glas.
Napomena: espeak-ng ne prihvata putanju do svojih podataka dužu od ~160 znakova, pa okruženje sa kokoro-onnx
ne sme biti duboko u folderima.
Model: KOKORO_DIR (podrazumevano scripts/.kokoro) sa kokoro-v1.0.onnx i voices-v1.0.bin
(https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0).
"""

import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

PAUZA = 0.12  # sekundi tišine posle svakog dela

ulaz = json.load(sys.stdin)
model_dir = os.environ.get("KOKORO_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), ".kokoro")
kokoro = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))

zvuk, trajanja, ucestanost = [], [], 24000
for deo in ulaz["delovi"]:
    uzorci, ucestanost = kokoro.create(deo, voice=ulaz.get("glas", "af_heart"), speed=ulaz.get("brzina", 1.05), lang="en-us")
    tisina = np.zeros(int(PAUZA * ucestanost), dtype=uzorci.dtype)
    zvuk.extend([uzorci, tisina])
    trajanja.append(round((len(uzorci) + len(tisina)) / ucestanost, 3))

sf.write(ulaz["izlaz"], np.concatenate(zvuk), ucestanost)
json.dump({"trajanja": trajanja, "ukupno": round(sum(trajanja), 3)}, sys.stdout)
