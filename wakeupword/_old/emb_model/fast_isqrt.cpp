

#include <stdio.h>
#include <stdint.h>
#include <math.h>
#include <assert.h>

#define USE_FLOAT 0
#define USE_DOUBLE 0

volatile uint32_t dummy;


static constexpr uint32_t tab[32] = {
    (uint32_t)sqrt((double)((1uLL << 32) - 1)),
    (uint32_t)sqrt((double)((1u << 31) - 1)),
    (uint32_t)sqrt((double)((1u << 30) - 1)),
    (uint32_t)sqrt((double)((1u << 29) - 1)),
    (uint32_t)sqrt((double)((1u << 28) - 1)),
    (uint32_t)sqrt((double)((1u << 27) - 1)),
    (uint32_t)sqrt((double)((1u << 26) - 1)),
    (uint32_t)sqrt((double)((1u << 25) - 1)),
    (uint32_t)sqrt((double)((1u << 24) - 1)),
    (uint32_t)sqrt((double)((1u << 23) - 1)),
    (uint32_t)sqrt((double)((1u << 22) - 1)),
    (uint32_t)sqrt((double)((1u << 21) - 1)),
    (uint32_t)sqrt((double)((1u << 20) - 1)),
    (uint32_t)sqrt((double)((1u << 19) - 1)),
    (uint32_t)sqrt((double)((1u << 18) - 1)),
    (uint32_t)sqrt((double)((1u << 17) - 1)),
    (uint32_t)sqrt((double)((1u << 16) - 1)),
    (uint32_t)sqrt((double)((1u << 15) - 1)),
    (uint32_t)sqrt((double)((1u << 14) - 1)),
    (uint32_t)sqrt((double)((1u << 13) - 1)),
    (uint32_t)sqrt((double)((1u << 12) - 1)),
    (uint32_t)sqrt((double)((1u << 11) - 1)),
    (uint32_t)sqrt((double)((1u << 10) - 1)),
    (uint32_t)sqrt((double)((1u << 9) - 1)),
    (uint32_t)sqrt((double)((1u << 8) - 1)),
    (uint32_t)sqrt((double)((1u << 7) - 1)),
    (uint32_t)sqrt((double)((1u << 6) - 1)),
    (uint32_t)sqrt((double)((1u << 5) - 1)),
    (uint32_t)sqrt((double)((1u << 4) - 1)),
    (uint32_t)sqrt((double)((1u << 3) - 1)),
    (uint32_t)sqrt((double)((1u << 2) - 1)),
    (uint32_t)sqrt((double)((1u << 1) - 1)),
};

static constexpr uint32_t tab2[64] = {
    0,
    0,
    (uint32_t)sqrt((double)((3u << 0) - 1)),
    (uint32_t)sqrt((double)((4u << 0) - 1)),
    (uint32_t)sqrt((double)((3u << 1) - 1)),
    (uint32_t)sqrt((double)((4u << 1) - 1)),
    (uint32_t)sqrt((double)((3u << 2) - 1)),
    (uint32_t)sqrt((double)((4u << 2) - 1)),
    (uint32_t)sqrt((double)((3u << 3) - 1)),
    (uint32_t)sqrt((double)((4u << 3) - 1)),
    (uint32_t)sqrt((double)((3u << 4) - 1)),
    (uint32_t)sqrt((double)((4u << 4) - 1)),
    (uint32_t)sqrt((double)((3u << 5) - 1)),
    (uint32_t)sqrt((double)((4u << 5) - 1)),
    (uint32_t)sqrt((double)((3u << 6) - 1)),
    (uint32_t)sqrt((double)((4u << 6) - 1)),
    (uint32_t)sqrt((double)((3u << 7) - 1)),
    (uint32_t)sqrt((double)((4u << 7) - 1)),
    (uint32_t)sqrt((double)((3u << 8) - 1)),
    (uint32_t)sqrt((double)((4u << 8) - 1)),
    (uint32_t)sqrt((double)((3u << 9) - 1)),
    (uint32_t)sqrt((double)((4u << 9) - 1)),
    (uint32_t)sqrt((double)((3u << 10) - 1)),
    (uint32_t)sqrt((double)((4u << 10) - 1)),
    (uint32_t)sqrt((double)((3u << 11) - 1)),
    (uint32_t)sqrt((double)((4u << 11) - 1)),
    (uint32_t)sqrt((double)((3u << 12) - 1)),
    (uint32_t)sqrt((double)((4u << 12) - 1)),
    (uint32_t)sqrt((double)((3u << 13) - 1)),
    (uint32_t)sqrt((double)((4u << 13) - 1)),
    (uint32_t)sqrt((double)((3u << 14) - 1)),
    (uint32_t)sqrt((double)((4u << 14) - 1)),
    (uint32_t)sqrt((double)((3u << 15) - 1)),
    (uint32_t)sqrt((double)((4u << 15) - 1)),
    (uint32_t)sqrt((double)((3u << 16) - 1)),
    (uint32_t)sqrt((double)((4u << 16) - 1)),
    (uint32_t)sqrt((double)((3u << 17) - 1)),
    (uint32_t)sqrt((double)((4u << 17) - 1)),
    (uint32_t)sqrt((double)((3u << 18) - 1)),
    (uint32_t)sqrt((double)((4u << 18) - 1)),
    (uint32_t)sqrt((double)((3u << 19) - 1)),
    (uint32_t)sqrt((double)((4u << 19) - 1)),
    (uint32_t)sqrt((double)((3u << 20) - 1)),
    (uint32_t)sqrt((double)((4u << 20) - 1)),
    (uint32_t)sqrt((double)((3u << 21) - 1)),
    (uint32_t)sqrt((double)((4u << 21) - 1)),
    (uint32_t)sqrt((double)((3u << 22) - 1)),
    (uint32_t)sqrt((double)((4u << 22) - 1)),
    (uint32_t)sqrt((double)((3u << 23) - 1)),
    (uint32_t)sqrt((double)((4u << 23) - 1)),
    (uint32_t)sqrt((double)((3u << 24) - 1)),
    (uint32_t)sqrt((double)((4u << 24) - 1)),
    (uint32_t)sqrt((double)((3u << 25) - 1)),
    (uint32_t)sqrt((double)((4u << 25) - 1)),
    (uint32_t)sqrt((double)((3u << 26) - 1)),
    (uint32_t)sqrt((double)((4u << 26) - 1)),
    (uint32_t)sqrt((double)((3u << 27) - 1)),
    (uint32_t)sqrt((double)((4u << 27) - 1)),
    (uint32_t)sqrt((double)((3u << 28) - 1)),
    (uint32_t)sqrt((double)((4u << 28) - 1)),
    (uint32_t)sqrt((double)((3u << 29) - 1)),
    (uint32_t)sqrt((double)((4u << 29) - 1)),
    (uint32_t)sqrt((double)((3u << 30) - 1)),
    (uint32_t)sqrt((double)((4uLL << 30) - 1)),
};

static constexpr uint32_t tab3[128] = {
    0,
    0,
    0,
    0,
    (uint32_t)sqrt((double)((5u << 0) - 1)),
    (uint32_t)sqrt((double)((6u << 0) - 1)),
    (uint32_t)sqrt((double)((7u << 0) - 1)),
    (uint32_t)sqrt((double)((8u << 0) - 1)),
    (uint32_t)sqrt((double)((5u << 1) - 1)),
    (uint32_t)sqrt((double)((6u << 1) - 1)),
    (uint32_t)sqrt((double)((7u << 1) - 1)),
    (uint32_t)sqrt((double)((8u << 1) - 1)),
    (uint32_t)sqrt((double)((5u << 2) - 1)),
    (uint32_t)sqrt((double)((6u << 2) - 1)),
    (uint32_t)sqrt((double)((7u << 2) - 1)),
    (uint32_t)sqrt((double)((8u << 2) - 1)),
    (uint32_t)sqrt((double)((5u << 3) - 1)),
    (uint32_t)sqrt((double)((6u << 3) - 1)),
    (uint32_t)sqrt((double)((7u << 3) - 1)),
    (uint32_t)sqrt((double)((8u << 3) - 1)),
    (uint32_t)sqrt((double)((5u << 4) - 1)),
    (uint32_t)sqrt((double)((6u << 4) - 1)),
    (uint32_t)sqrt((double)((7u << 4) - 1)),
    (uint32_t)sqrt((double)((8u << 4) - 1)),
    (uint32_t)sqrt((double)((5u << 5) - 1)),
    (uint32_t)sqrt((double)((6u << 5) - 1)),
    (uint32_t)sqrt((double)((7u << 5) - 1)),
    (uint32_t)sqrt((double)((8u << 5) - 1)),
    (uint32_t)sqrt((double)((5u << 6) - 1)),
    (uint32_t)sqrt((double)((6u << 6) - 1)),
    (uint32_t)sqrt((double)((7u << 6) - 1)),
    (uint32_t)sqrt((double)((8u << 6) - 1)),
    (uint32_t)sqrt((double)((5u << 7) - 1)),
    (uint32_t)sqrt((double)((6u << 7) - 1)),
    (uint32_t)sqrt((double)((7u << 7) - 1)),
    (uint32_t)sqrt((double)((8u << 7) - 1)),
    (uint32_t)sqrt((double)((5u << 8) - 1)),
    (uint32_t)sqrt((double)((6u << 8) - 1)),
    (uint32_t)sqrt((double)((7u << 8) - 1)),
    (uint32_t)sqrt((double)((8u << 8) - 1)),
    (uint32_t)sqrt((double)((5u << 9) - 1)),
    (uint32_t)sqrt((double)((6u << 9) - 1)),
    (uint32_t)sqrt((double)((7u << 9) - 1)),
    (uint32_t)sqrt((double)((8u << 9) - 1)),
    (uint32_t)sqrt((double)((5u << 10) - 1)),
    (uint32_t)sqrt((double)((6u << 10) - 1)),
    (uint32_t)sqrt((double)((7u << 10) - 1)),
    (uint32_t)sqrt((double)((8u << 10) - 1)),
    (uint32_t)sqrt((double)((5u << 11) - 1)),
    (uint32_t)sqrt((double)((6u << 11) - 1)),
    (uint32_t)sqrt((double)((7u << 11) - 1)),
    (uint32_t)sqrt((double)((8u << 11) - 1)),
    (uint32_t)sqrt((double)((5u << 12) - 1)),
    (uint32_t)sqrt((double)((6u << 12) - 1)),
    (uint32_t)sqrt((double)((7u << 12) - 1)),
    (uint32_t)sqrt((double)((8u << 12) - 1)),
    (uint32_t)sqrt((double)((5u << 13) - 1)),
    (uint32_t)sqrt((double)((6u << 13) - 1)),
    (uint32_t)sqrt((double)((7u << 13) - 1)),
    (uint32_t)sqrt((double)((8u << 13) - 1)),
    (uint32_t)sqrt((double)((5u << 14) - 1)),
    (uint32_t)sqrt((double)((6u << 14) - 1)),
    (uint32_t)sqrt((double)((7u << 14) - 1)),
    (uint32_t)sqrt((double)((8u << 14) - 1)),
    (uint32_t)sqrt((double)((5u << 15) - 1)),
    (uint32_t)sqrt((double)((6u << 15) - 1)),
    (uint32_t)sqrt((double)((7u << 15) - 1)),
    (uint32_t)sqrt((double)((8u << 15) - 1)),
    (uint32_t)sqrt((double)((5u << 16) - 1)),
    (uint32_t)sqrt((double)((6u << 16) - 1)),
    (uint32_t)sqrt((double)((7u << 16) - 1)),
    (uint32_t)sqrt((double)((8u << 16) - 1)),
    (uint32_t)sqrt((double)((5u << 17) - 1)),
    (uint32_t)sqrt((double)((6u << 17) - 1)),
    (uint32_t)sqrt((double)((7u << 17) - 1)),
    (uint32_t)sqrt((double)((8u << 17) - 1)),
    (uint32_t)sqrt((double)((5u << 18) - 1)),
    (uint32_t)sqrt((double)((6u << 18) - 1)),
    (uint32_t)sqrt((double)((7u << 18) - 1)),
    (uint32_t)sqrt((double)((8u << 18) - 1)),
    (uint32_t)sqrt((double)((5u << 19) - 1)),
    (uint32_t)sqrt((double)((6u << 19) - 1)),
    (uint32_t)sqrt((double)((7u << 19) - 1)),
    (uint32_t)sqrt((double)((8u << 19) - 1)),
    (uint32_t)sqrt((double)((5u << 20) - 1)),
    (uint32_t)sqrt((double)((6u << 20) - 1)),
    (uint32_t)sqrt((double)((7u << 20) - 1)),
    (uint32_t)sqrt((double)((8u << 20) - 1)),
    (uint32_t)sqrt((double)((5u << 21) - 1)),
    (uint32_t)sqrt((double)((6u << 21) - 1)),
    (uint32_t)sqrt((double)((7u << 21) - 1)),
    (uint32_t)sqrt((double)((8u << 21) - 1)),
    (uint32_t)sqrt((double)((5u << 22) - 1)),
    (uint32_t)sqrt((double)((6u << 22) - 1)),
    (uint32_t)sqrt((double)((7u << 22) - 1)),
    (uint32_t)sqrt((double)((8u << 22) - 1)),
    (uint32_t)sqrt((double)((5u << 23) - 1)),
    (uint32_t)sqrt((double)((6u << 23) - 1)),
    (uint32_t)sqrt((double)((7u << 23) - 1)),
    (uint32_t)sqrt((double)((8u << 23) - 1)),
    (uint32_t)sqrt((double)((5u << 24) - 1)),
    (uint32_t)sqrt((double)((6u << 24) - 1)),
    (uint32_t)sqrt((double)((7u << 24) - 1)),
    (uint32_t)sqrt((double)((8u << 24) - 1)),
    (uint32_t)sqrt((double)((5u << 25) - 1)),
    (uint32_t)sqrt((double)((6u << 25) - 1)),
    (uint32_t)sqrt((double)((7u << 25) - 1)),
    (uint32_t)sqrt((double)((8u << 25) - 1)),
    (uint32_t)sqrt((double)((5u << 26) - 1)),
    (uint32_t)sqrt((double)((6u << 26) - 1)),
    (uint32_t)sqrt((double)((7u << 26) - 1)),
    (uint32_t)sqrt((double)((8u << 26) - 1)),
    (uint32_t)sqrt((double)((5u << 27) - 1)),
    (uint32_t)sqrt((double)((6u << 27) - 1)),
    (uint32_t)sqrt((double)((7u << 27) - 1)),
    (uint32_t)sqrt((double)((8u << 27) - 1)),
    (uint32_t)sqrt((double)((5u << 28) - 1)),
    (uint32_t)sqrt((double)((6u << 28) - 1)),
    (uint32_t)sqrt((double)((7u << 28) - 1)),
    (uint32_t)sqrt((double)((8u << 28) - 1)),
    (uint32_t)sqrt((double)((5u << 29) - 1)),
    (uint32_t)sqrt((double)((6u << 29) - 1)),
    (uint32_t)sqrt((double)((7u << 29) - 1)),
    (uint32_t)sqrt((double)((8u << 29) - 1)),
    (uint32_t)sqrt((double)((5u << 30) - 1)),
    (uint32_t)sqrt((double)((6u << 30) - 1)),
    (uint32_t)sqrt((double)((7u << 30) - 1)),
    (uint32_t)sqrt((double)((8uLL << 30) - 1)),
};

#define likely(x)   __builtin_expect(!!(x), 1)
#define unlikely(x) __builtin_expect(!!(x), 0)

uint32_t isqrt(uint32_t s) {
    if (USE_DOUBLE) {
        return (uint32_t)std::sqrt((double)s);
    } else if (USE_FLOAT) {
        uint32_t x0 = (uint32_t)std::sqrt((float)s);
        if (s < 16777216u) {
            return x0;
        } else {
            uint32_t mul1 = x0 * x0;
            if (unlikely(s <= mul1 - 1)) return x0 - 1;
            uint32_t mul2 = mul1 + 2 * x0;
            if (likely(s <= mul2)) return x0;
            return x0 + 1;
        }
    } else if (s <= 1) {
        return s;
    } else {
        int bits = 30 - __builtin_clz(s);
        uint32_t x0 = (1U << (bits >> 1)) * (2U + (bits & 1));
        // uint32_t x0 = tab[__builtin_clz(s)];
        // int rem_bits = 30 - __builtin_clz(s);
        // uint32_t x0 = tab2[2 * rem_bits + (s >> rem_bits)];
        // int rem_bits = 29 - __builtin_clz(s);
        // uint32_t x0 = tab3[4 * rem_bits + (s >> rem_bits)];
        uint32_t x1 = (x0 + s / x0) / 2u;
        /*if (unlikely(x1 >= x0)) {
            printf("%u %u\n", s, x0); return 0;
            return x0;
        }*/
        x0 = (x1 + s / x1) / 2u;
        if (x0 >= x1) {
            //printf("%u %u\n", s, x0); return 0;
            return x1;
        }
        x1 = (x0 + s / x0) / 2u;
        if (x1 >= x0) return x0;
        x0 = (x1 + s / x1) / 2u;
        if (likely(x0 >= x1)) return x1;
        // x1 = (x0 + s / x0) / 2;
        // if (x1 >= x0) return x0;
        // x0 = (x1 + s / x1) / 2;
        // if (x0 >= x1) return x1;
        //assert(false);
        //printf("%u %u\n", s, x0); // return 0;
        return x0;
        //return 0;
    }
}

int main() {
    for (uint64_t x1 = 0x000000000uLL; x1 < 0x100000000uLL; x1++) {
        uint32_t x = x1;
        //x1 ^= 0x9873FE9A;
        auto y = isqrt(x);
        bool ok = y * y <= x && ((uint64_t)y + 1uLL) * ((uint64_t)y + 1uLL) > x;
        if (!ok || y != (uint32_t)sqrt(x)) {
            printf("%u = isqrt(%u)\n", y, (uint32_t)x);
            printf("%u = %u * %u\n", y * y, y, y);
            printf("%llu = %llu * %llu\n", ((uint64_t)y + 1uLL) * ((uint64_t)y + 1uLL), ((uint64_t)y + 1uLL), ((uint64_t)y + 1uLL));
            printf("%u = (int)sqrt(%u)\n", (uint32_t)sqrt(x), (uint32_t)x);
            assert(false);
        }
    }
    return 0;
}
