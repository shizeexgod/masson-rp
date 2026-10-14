"""Masson RP: накладывает скин интерфейсов (cef-skin/overlay) на рабочую копию RedAge.

    python apply-cef-skin.py <путь к src_cef>

Файлы overlay/src/** копируются поверх src_cef/src/** (своё — masson/*, заменённые экраны RedAge — по тем же путям).
Скрипт можно запускать повторно. Исходники RedAge (C:\\MassonRP\\src\\redage) он не трогает: меняется только рабочая копия.
"""
import os, shutil, sys

if len(sys.argv) < 2:
    sys.exit(__doc__)

target = os.path.abspath(sys.argv[1])
here = os.path.dirname(os.path.abspath(__file__))
overlay = os.path.join(here, '..', 'overlay', 'src')
dst_src = os.path.join(target, 'src')
if not os.path.isdir(dst_src):
    sys.exit('нет папки src в ' + target)

copied = 0
for root, _, files in os.walk(overlay):
    rel = os.path.relpath(root, overlay)
    out = os.path.normpath(os.path.join(dst_src, rel))
    os.makedirs(out, exist_ok=True)
    for f in files:
        shutil.copyfile(os.path.join(root, f), os.path.join(out, f))
        copied += 1
print('скопировано файлов:', copied, '->', dst_src)
