"""Validate a .docx against the schema Word implements.

Everything else in this example checks the memorandum: the offsets, the
spacing, the wording of the regulation. This checks the *file* - whether Word
will open it at all.

Word validates each part it reads against ISO/IEC 29500-4 (ECMA-376). A part
that violates the schema does not render slightly wrong; it produces "Word
found unreadable content" and an offer to repair, and the memorandum never
reaches the page. LibreOffice is lenient by design and renders through faults
Word rejects, so no amount of rendering catches this - only the schema does.

That is not hypothetical. Both of these passed a rendered page and would have
failed in Word:

  - `ImportedXmlComponent.fromXmlString` returns the document node, not the
    element, so every content control shipped wrapped in a literal
    `<undefined>` element.
  - `w:documentProtection` was written ahead of `w:displayBackgroundShape`,
    which outranks it in the `w:settings` sequence.

Usage:
    python3 validate-ooxml.py <file.docx> [<file.docx> ...]

The schemas are not vendored here. Point MEMO_OOXML_SCHEMAS at a directory
holding the ISO/IEC 29500-4 XSDs, or leave it unset and they are looked for
where the Claude `docx` skill keeps them. Without them - or without lxml -
this exits 3 and says so, so a caller can report a skip rather than a pass.
"""

import os
import sys
import zipfile
from pathlib import Path

WML_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

# Markup Compatibility and Extensibility (ECMA-376 Part 3). A file carries
# extensions - `w14:paraId`, `wp14:` drawing positions, the `mc:Ignorable`
# attribute that lists them - which a conforming consumer discards before
# reading, and which the ISO schema therefore does not describe. Discard them
# here for the same reason, so what is validated is what Word is asked to
# understand. Anything outside this set is by definition ignorable.
OOXML_NAMESPACES = {
    WML_NS,
    "http://schemas.openxmlformats.org/officeDocument/2006/math",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "http://schemas.openxmlformats.org/officeDocument/2006/sharedTypes",
    "http://schemas.openxmlformats.org/schemaLibrary/2006/main",
    "http://schemas.openxmlformats.org/drawingml/2006/main",
    "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "http://www.w3.org/XML/1998/namespace",
}


def drop_ignorable(element):
    """Remove everything a conforming consumer ignores, in place."""
    for node in list(element):
        if not isinstance(node.tag, str):        # comments, processing instructions
            element.remove(node)
            continue
        if node.tag.startswith("{") and node.tag.split("}")[0][1:] not in OOXML_NAMESPACES:
            element.remove(node)
            continue
        drop_ignorable(node)

    for name in [a for a in element.attrib
                 if a.startswith("{") and a.split("}")[0][1:] not in OOXML_NAMESPACES]:
        del element.attrib[name]

# The wordprocessingml parts wml.xsd declares a root element for. Anything
# else in the package (relationships, content types, docProps) is written by
# the library, not by this example, and is governed by other schemas.
WML_ROOTS = {
    "document", "hdr", "ftr", "styles", "settings", "numbering", "fonts",
    "webSettings", "comments", "footnotes", "endnotes", "glossaryDocument",
}


def find_schema_dir():
    explicit = os.environ.get("MEMO_OOXML_SCHEMAS")
    if explicit:
        path = Path(explicit)
        return path if (path / "wml.xsd").is_file() else None

    for candidate in sorted(Path.home().glob(
            ".claude/skills/*/scripts/office/schemas/ISO-IEC29500-4_2016")):
        if (candidate / "wml.xsd").is_file():
            return candidate
    return None


def main(argv):
    if len(argv) < 2:
        print("usage: validate-ooxml.py <file.docx> [...]", file=sys.stderr)
        return 2

    try:
        from lxml import etree
    except ImportError:
        print("skip: lxml is not installed", file=sys.stderr)
        return 3

    schema_dir = find_schema_dir()
    if schema_dir is None:
        print("skip: no ISO/IEC 29500-4 schemas found; set MEMO_OOXML_SCHEMAS",
              file=sys.stderr)
        return 3

    # wml.xsd imports its siblings by relative path, so it resolves them from
    # its own directory.
    schema = etree.XMLSchema(etree.parse(str(schema_dir / "wml.xsd")))

    failures = 0
    checked = 0
    for path in argv[1:]:
        with zipfile.ZipFile(path) as package:
            for name in sorted(package.namelist()):
                if not name.endswith(".xml") or name.startswith("docProps/"):
                    continue
                try:
                    part = etree.fromstring(package.read(name))
                except etree.XMLSyntaxError as exc:
                    print(f"FAIL {Path(path).name}:{name}: not well-formed: {exc}")
                    failures += 1
                    continue

                tag = etree.QName(part)
                if tag.namespace != WML_NS or tag.localname not in WML_ROOTS:
                    continue

                drop_ignorable(part)
                checked += 1
                if schema.validate(part):
                    continue

                failures += 1
                for error in schema.error_log:
                    print(f"FAIL {Path(path).name}:{name}:{error.line}: {error.message}")

    print(f"{checked} parts validated against ISO/IEC 29500-4, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
