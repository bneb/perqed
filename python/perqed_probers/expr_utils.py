"""
Mathematical Expression Normalization & Safe AST Utilities for Perqed Probers
"""

import re
from typing import Dict, Any


def normalize_math_expr(expr_str: str) -> str:
    """
    Normalizes mathematical formulas for Python/Z3/SymPy evaluation:
    - Normalizes Unicode math operators: ≤, ≥, ≠, ∧, ∨, ¬, ·, ×, ÷
    - Replaces powers: ^ -> **
    - Replaces boolean symbols: && -> and, || -> or, ! -> not (preserving !=)
    - Replaces single = with == (preserving <=, >=, !=, ==)
    - Cleans redundant whitespace
    """
    clean = expr_str.strip()
    if not clean:
        return "True"

    # 1. Unicode mathematical operators normalization
    clean = clean.replace("≤", "<=").replace("≥", ">=").replace("≠", "!=")
    clean = clean.replace("∧", " and ").replace("∨", " or ").replace("¬", " not ")
    clean = clean.replace("·", "*").replace("×", "*").replace("÷", "/")

    # 2. Replace powers
    clean = clean.replace("^", "**")

    # 3. Replace boolean ops
    clean = re.sub(r'&&', ' and ', clean)
    clean = re.sub(r'\|\|', ' or ', clean)
    # Replace ! that is not part of !=
    clean = re.sub(r'!(?!=)', ' not ', clean)

    # 4. Replace single = with == without corrupting <=, >=, !=, ==
    clean = re.sub(r'(?<![<>=!])=(?!=)', '==', clean)

    return clean.strip()
