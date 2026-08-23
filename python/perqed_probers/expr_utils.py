"""
Mathematical Expression Normalization & Safe AST Utilities for Perqed Probers
"""

import re
from typing import Dict, Any


def normalize_math_expr(expr_str: str) -> str:
    """
    Normalizes mathematical formulas for Python/Z3/SymPy evaluation:
    - Replaces powers: ^ -> **
    - Replaces boolean symbols: && -> and, || -> or, ! -> not (preserving !=)
    - Replaces single = with == (preserving <=, >=, !=, ==)
    - Cleans redundant whitespace
    """
    clean = expr_str.strip()
    if not clean:
        return "True"

    # 1. Replace powers
    clean = clean.replace("^", "**")

    # 2. Replace boolean ops
    clean = re.sub(r'&&', ' and ', clean)
    clean = re.sub(r'\|\|', ' or ', clean)
    # Replace ! that is not part of !=
    clean = re.sub(r'!(?!=)', ' not ', clean)

    # 3. Replace single = with == without corrupting <=, >=, !=, ==
    clean = re.sub(r'(?<![<>=!])=(?!=)', '==', clean)

    return clean.strip()
