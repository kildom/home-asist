

#include <stdint.h>
#include <stdio.h>
#include <math.h>

/** Calculate approximation of log2 of integer using fixed-point arithmetic.
 *
 *  - If you want to use different fixed point input format, substract number of
 *    desired input fraction bits from returned value.
 *  - If you want to use different logarithm base b, divide result by log2(b).
 *    e.g. ln(x) = (intlog2(x) >> 12) * 2839
 *  - For input 0 returns 0.
 * @param x The input integer (32.0 fixed-point notation)
 * @returns Calculated value in 6.26 fixed point representation.
 */
int32_t intlog2(uint32_t x) {
    if (x <= 1) {
        return 0;
    }
    uint32_t lz = __builtin_clz(x);
    uint32_t integral = 31 - lz;
    uint32_t rem = (x << (lz + 1)) >> 19;
    uint32_t frac = 688 * 1024 * rem - 22 * rem * rem;
    uint32_t y = (integral << 26) + (frac >> 6);
    return (int32_t)y;
}

int32_t intlog2_frac(uint32_t x, uint32_t frac_bits) {
    return intlog2(x) - (frac_bits << 26);
}

int32_t intln_frac(uint32_t x, uint32_t frac_bits) {
    return (intlog2_frac(x, frac_bits) >> 12) * 2839;
}


int main() {
    // for (uint32_t i = 1; i > 0; i++) {
    //     double a = (double)intlog2(i) / (double)(1 << 26);
    //     double b = log2((double)i);
    //     if ((a - b) * 100.0 / b > 0.26) {
    //         printf("%d: %f - %f = %f (%f%%)\n", i, a, b, a - b, (a - b) * 100.0 / b);
    //         return 1;
    //     }
    //     if (!(i & 0x00FFFFFF)) {
    //         printf("%d\n", i >> 24);
    //     }
    // }
    // for (uint32_t i = 1; i > 0; i++) {
    //     double a = (double)intlog2_frac(i, 10) / (double)(1 << 26);
    //     double b = log2((double)i / 1024.0);
    //     double aa = pow(2.0, a) * 1024.0;
    //     double bb = (double)i;
    //     if (fabs((aa - bb) * 100.0 / bb) > 0.57) {
    //         printf("%d: i=%f - f=%f, %f - %f = %f (%f%%)\n", i, a, b, aa, bb, aa - bb, (aa - bb) * 100.0 / bb);
    //         return 1;
    //     }
    //     if (!(i & 0x00FFFFFF)) {
    //         printf("%d\n", i >> 24);
    //     }
    // }
    double maxErr = 0.0;
    for (uint32_t i = 0x00000001; i > 0; i++) {
        double a = (double)intln_frac(i, 10) / (double)(1 << 26);
        double b = log((double)i / 1024.0);
        double aa = exp(a) * 1024.0;
        double bb = (double)i;
        double err = fabs((aa - bb) * 100.0 / bb);
        maxErr = fmax(maxErr, err);
        if (err > 0.64) {
            printf("%d: i=%f - f=%f, %f - %f = %f (%f%%)\n", i, a, b, aa, bb, aa - bb, (aa - bb) * 100.0 / bb);
            return 1;
        }
        if (!(i & 0x00FFFFFF)) {
            printf("%d, err: %f\n", i >> 24, maxErr);
            maxErr = 0;
        }
    }
    printf("err: %f\n", maxErr);
    return 0;
}
