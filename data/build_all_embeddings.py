"""Run preprocess_json.py for every registered corpus.

Called from the Dockerfile at build time. Doing all corpora in one Python
session lets us reuse the loaded sentence-transformers model across courses
instead of paying the ~1.5GB load cost N times.

Run locally with:
    cd data && EMBEDDER=sentence_transformers python build_all_embeddings.py
"""

import os
import sys
from pathlib import Path

# Import preprocess_json from the same directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import preprocess_json  # noqa: E402

# Order matters slightly: the first entry uses --replace to start a fresh
# joblib; subsequent entries merge into it.
CORPORA = [
    ("ml-andrew-ng-c1",        "jsons.json"),
    ("genai-rag-langchain",    "genai_rag_chunks.json"),
    ("ds-python-libraries",    "ds_python_chunks.json"),
    ("cs-data-structures",     "cs_dsa_chunks.json"),
    ("cs-algorithms",          "cs_algorithms_chunks.json"),
    ("cs-operating-systems",   "cs_os_chunks.json"),
    ("cs-dbms",                "cs_dbms_chunks.json"),
    ("cs-computer-networks",   "cs_networks_chunks.json"),
    ("cs-software-engineering", "cs_software_engineering_chunks.json"),
    ("cs-ai-general",          "cs_ai_chunks.json"),
    ("cs-compiler-design",     "cs_compiler_design_chunks.json"),
    ("cs-cybersecurity",       "cs_cybersecurity_chunks.json"),
    ("cs-cloud-computing",     "cs_cloud_computing_chunks.json"),
    ("cs-web-development",     "cs_web_dev_chunks.json"),
    ("cs-programming",         "cs_programming_chunks.json"),
]


def main():
    backend = os.getenv("EMBEDDER", "sentence_transformers")
    output = "embeddings.joblib"

    for i, (course_id, input_file) in enumerate(CORPORA):
        replace = (i == 0)  # start fresh on the first corpus
        argv = [
            "preprocess_json.py",
            "--course", course_id,
            "--input", input_file,
            "--output", output,
            "--embedder", backend,
        ]
        if replace:
            argv.append("--replace")
        print(f"[{i + 1}/{len(CORPORA)}] embedding {course_id}", flush=True)
        # preprocess_json.main reads sys.argv via argparse, so swap it in.
        sys.argv = argv
        preprocess_json.main()


if __name__ == "__main__":
    main()
