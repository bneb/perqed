import Lake
open Lake DSL

package «goldbach-geodesic» where
  name := "GoldbachGeodesic"

require mathlib from git
  "https://github.com/leanprover-community/mathlib4" @ "v4.14.0"

lean_lib «GoldbachGeodesic» where
  roots := #[`GoldbachGeodesic]
