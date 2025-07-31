from pathlib import Path
import sys
from dataclasses import dataclass
from typing import List

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python search_and_process.py <search_directory>")
        sys.exit(1)
    find_and_process_files(sys.argv[1])
