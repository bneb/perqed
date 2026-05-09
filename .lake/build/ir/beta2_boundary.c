// Lean compiler output
// Module: beta2_boundary
// Imports: public import Init public meta import Init public import Mathlib public import erdos265_strict_target
#include <lean/lean.h>
#if defined(__clang__)
#pragma clang diagnostic ignored "-Wunused-parameter"
#pragma clang diagnostic ignored "-Wunused-label"
#elif defined(__GNUC__) && !defined(__CLANG__)
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wunused-label"
#pragma GCC diagnostic ignored "-Wunused-but-set-variable"
#endif
#ifdef __cplusplus
extern "C" {
#endif
lean_object* l_List_range(lean_object*);
lean_object* lp_mathlib_Finset_prod___at___00primorial_spec__1___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_prod__prefix___lam__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_prod__prefix(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_prod__prefix___lam__0(lean_object* v_a_1_, lean_object* v_i_2_){
_start:
{
lean_object* v___x_3_; 
v___x_3_ = lean_apply_1(v_a_1_, v_i_2_);
return v___x_3_;
}
}
LEAN_EXPORT lean_object* lp_perqed_prod__prefix(lean_object* v_a_4_, lean_object* v_N_5_){
_start:
{
lean_object* v___f_6_; lean_object* v___x_7_; lean_object* v___x_8_; 
v___f_6_ = lean_alloc_closure((void*)(lp_perqed_prod__prefix___lam__0), 2, 1);
lean_closure_set(v___f_6_, 0, v_a_4_);
v___x_7_ = l_List_range(v_N_5_);
v___x_8_ = lp_mathlib_Finset_prod___at___00primorial_spec__1___redArg(v___x_7_, v___f_6_);
return v___x_8_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_mathlib_Mathlib(uint8_t builtin);
lean_object* initialize_perqed_erdos265__strict__target(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_perqed_beta2__boundary(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_mathlib_Mathlib(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_perqed_erdos265__strict__target(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
