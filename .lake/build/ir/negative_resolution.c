// Lean compiler output
// Module: negative_resolution
// Imports: public import Init public meta import Init public import Mathlib
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
lean_object* lean_nat_mul(lean_object*, lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_history__product___lam__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_history__product(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_history__product___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_history__product__shift___lam__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_history__product__shift(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_history__product__shift___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lp_perqed_history__product___lam__0(lean_object* v_a_1_, lean_object* v_i_2_){
_start:
{
lean_object* v___x_3_; 
v___x_3_ = lean_apply_1(v_a_1_, v_i_2_);
return v___x_3_;
}
}
LEAN_EXPORT lean_object* lp_perqed_history__product(lean_object* v_q_4_, lean_object* v_a_5_, lean_object* v_N_6_){
_start:
{
lean_object* v___f_7_; lean_object* v___x_8_; lean_object* v___x_9_; lean_object* v___x_10_; 
v___f_7_ = lean_alloc_closure((void*)(lp_perqed_history__product___lam__0), 2, 1);
lean_closure_set(v___f_7_, 0, v_a_5_);
v___x_8_ = l_List_range(v_N_6_);
v___x_9_ = lp_mathlib_Finset_prod___at___00primorial_spec__1___redArg(v___x_8_, v___f_7_);
v___x_10_ = lean_nat_mul(v_q_4_, v___x_9_);
lean_dec(v___x_9_);
return v___x_10_;
}
}
LEAN_EXPORT lean_object* lp_perqed_history__product___boxed(lean_object* v_q_11_, lean_object* v_a_12_, lean_object* v_N_13_){
_start:
{
lean_object* v_res_14_; 
v_res_14_ = lp_perqed_history__product(v_q_11_, v_a_12_, v_N_13_);
lean_dec(v_q_11_);
return v_res_14_;
}
}
LEAN_EXPORT lean_object* lp_perqed_history__product__shift___lam__0(lean_object* v_a_15_, lean_object* v_i_16_){
_start:
{
lean_object* v___x_17_; lean_object* v___x_18_; lean_object* v___x_19_; 
v___x_17_ = lean_apply_1(v_a_15_, v_i_16_);
v___x_18_ = lean_unsigned_to_nat(1u);
v___x_19_ = lean_nat_sub(v___x_17_, v___x_18_);
lean_dec(v___x_17_);
return v___x_19_;
}
}
LEAN_EXPORT lean_object* lp_perqed_history__product__shift(lean_object* v_q_20_, lean_object* v_a_21_, lean_object* v_N_22_){
_start:
{
lean_object* v___f_23_; lean_object* v___x_24_; lean_object* v___x_25_; lean_object* v___x_26_; 
v___f_23_ = lean_alloc_closure((void*)(lp_perqed_history__product__shift___lam__0), 2, 1);
lean_closure_set(v___f_23_, 0, v_a_21_);
v___x_24_ = l_List_range(v_N_22_);
v___x_25_ = lp_mathlib_Finset_prod___at___00primorial_spec__1___redArg(v___x_24_, v___f_23_);
v___x_26_ = lean_nat_mul(v_q_20_, v___x_25_);
lean_dec(v___x_25_);
return v___x_26_;
}
}
LEAN_EXPORT lean_object* lp_perqed_history__product__shift___boxed(lean_object* v_q_27_, lean_object* v_a_28_, lean_object* v_N_29_){
_start:
{
lean_object* v_res_30_; 
v_res_30_ = lp_perqed_history__product__shift(v_q_27_, v_a_28_, v_N_29_);
lean_dec(v_q_27_);
return v_res_30_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_mathlib_Mathlib(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_perqed_negative__resolution(uint8_t builtin) {
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
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
