"""Brace/quote-aware scanner for <Button ...> opening tags.

A naive `<Button[^>]*>` regex STOPS AT THE FIRST `>`. But JSX attributes routinely
contain `>` inside arrow functions (`onClick={() => ...}`) and inside JSX
expressions, so the naive pattern truncates the tag mid-attribute and then mistakes
the remaining attribute text for "visible children" — which hid 4 of 5 real
offenders on main. This scanner tracks quote and brace depth to find the true end
of the opening tag.
"""

import re
import sys
from pathlib import Path


def find_open_tag(src: str, start: int) -> tuple[int, str] | None:
    """Given the index of '<Button', return (end_index_exclusive, full_tag_text).

    Tracks single/double quotes, template literals and {} depth so that '>' inside
    an attribute value or arrow function does not terminate the tag.
    """
    i = start
    n = len(src)
    depth = 0
    quote = None
    while i < n:
        ch = src[i]
        if quote:
            if ch == "\\" and quote != "`":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
            i += 1
            continue
        if ch == "}":
            depth -= 1
            i += 1
            continue
        if ch == ">" and depth == 0:
            return i + 1, src[start : i + 1]
        i += 1
    return None


def scan_button_tags(src: str) -> list[tuple[int, int, str]]:
    """Yield (start, end, tag) for every <Button ...> opening tag."""
    out = []
    for m in re.finditer(r"<Button(?=[\s/>])", src):
        found = find_open_tag(src, m.start())
        if found:
            end, tag = found
            out.append((m.start(), end, tag))
    return out


def visible_text(children: str) -> str:
    """Strip JSX tags and {expressions}, leaving only rendered text."""
    # remove nested JSX elements
    txt = re.sub(r"<[^>]*>", " ", children)
    # remove JSX expression containers (may span lines)
    txt = re.sub(r"\{[^{}]*\}", " ", txt)
    txt = re.sub(r"\{[\s\S]*?\}", " ", txt)
    return " ".join(txt.split())


def unnamed_icon_buttons(path: Path) -> list[tuple[int, str, str]]:
    src = path.read_text(encoding="utf8")
    offenders = []
    for start, end, tag in scan_button_tags(src):
        if 'size="icon"' not in tag:
            continue
        if "aria-label" in tag or "aria-labelledby" in tag:
            continue
        # `{...props}` spread means the accessible name is supplied by the CALLER
        # (e.g. react-day-picker passes aria-label to CalendarDayButton). A
        # self-closing primitive that forwards props is not an offender we can
        # judge statically — flagging it produced a false positive on calendar.tsx.
        if tag.rstrip().endswith("/>") and "{...props}" in tag:
            continue

        # Self-closing tags have NO children; searching for </Button> would overrun
        # into unrelated code and manufacture fake "visible text".
        if tag.rstrip().endswith("/>"):
            children = ""
        else:
            close = src.find("</Button>", end)
            children = src[end:close] if close != -1 else src[end : end + 200]

        # An sr-only span is a legitimate accessible name even though it is not
        # visually rendered. sidebar.tsx already does this correctly.
        if "sr-only" in children:
            continue
        if visible_text(children):
            continue  # has a rendered text child -> named
        line = src[:start].count("\n") + 1
        offenders.append((line, " ".join(tag.split())[:110], " ".join(children.split())[:60]))
    return offenders


def main(root: str) -> int:
    src_dir = Path(root)
    total = 0
    files_with = []
    for f in sorted(src_dir.rglob("*.tsx")):
        if ".test." in f.name:
            continue
        offs = unnamed_icon_buttons(f)
        if offs:
            files_with.append((f, offs))
            total += len(offs)
    for f, offs in files_with:
        for line, tag, kids in offs:
            print(f"  {f.relative_to(src_dir.parent)}:{line}")
            print(f"      tag     : {tag}")
            print(f"      children: {kids}")
    print(f"\nTOTAL unnamed size=\"icon\" buttons: {total}")
    return total


if __name__ == "__main__":
    sys.exit(0 if main(sys.argv[1] if len(sys.argv) > 1 else "src") == 0 else 1)
