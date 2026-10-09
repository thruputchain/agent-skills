"""Validate the Thruput skill's entry point and local reference links."""

from pathlib import Path
import re


def check(root: Path) -> None:
    entry = root / "SKILL.md"
    text = entry.read_text()
    assert text.startswith("---\nname: thruput\n"), "invalid skill identity"
    assert "description:" in text.split("---", 2)[1], "missing description"
    assert len(text.splitlines()) < 500, "entry point is too long"
    references = set()
    for page in [entry, *sorted((root / "references").glob("*.md"))]:
        content = page.read_text()
        assert content.endswith("\n"), f"missing final newline: {page}"
        for link in re.findall(r"\]\(([^)]+)\)", content):
            if "://" in link or link.startswith("#"):
                continue
            target = (page.parent / link.split("#", 1)[0]).resolve()
            assert target.is_relative_to(root.resolve()), f"external file link: {link}"
            assert target.is_file(), f"broken link in {page}: {link}"
            if page == entry:
                references.add(target)
    assert references == set((root / "references").resolve().glob("*.md")), \
        "all references must be linked from SKILL.md"


if __name__ == "__main__":
    check(Path(__file__).resolve().parents[1] / "skills" / "thruput")
    print("Thruput skill checks passed")
