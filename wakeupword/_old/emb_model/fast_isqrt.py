
import math

tab = [ math.floor(math.sqrt((1 << x) - 1)) for x in range(33) ]
assert [ (x + 1) * (x + 1) >= x for x in tab ] == [ True ] * 33

tab2 = [0] * 62
for i in range(62):
    ii = i + 6
    if (ii & 1) == 0:
        bits = (ii - 2) // 2
        x = (1 << bits) - 1 - (1 << (bits - 2))
    else:
        bits = (ii - 3) // 2
        x = (1 << bits) - 1
    tab2[i] = math.floor(math.sqrt(x))

print(tab)
print(tab2)

def isqrt(s: int) -> int:
    global max_s, max_count
    if s <= 1:
        return s
    bits = int.bit_length(s)
    x0 = tab[bits]
    x1 = (x0 + s // x0) // 2
    i = 0
    while (x1 < x0):
        x0 = x1
        x1 = (x0 + s // x0) // 2
        i += 1
        if i > max_count:
            max_count = i
            max_s = s
            print(f"Max s: {max_s}, max count: {max_count}")
    return x0

def isqrt2(s: int) -> int:
    global max_s, max_count
    if s <= 1:
        return s
    bits = int.bit_length(s)
    index = (s >> (bits - 2)) + 2 * bits - 6
    x0 = tab2[index]
    x1 = (x0 + s // x0) // 2
    i = 0
    while (x1 < x0):
        x0 = x1
        x1 = (x0 + s // x0) // 2
        i += 1
        if i > max_count:
            max_count = i
            max_s = s
            print(f"Max s: {max_s}, max count: {max_count}, index: {index}, tab: {tab2[index]}, res: {x0}")
    return x0

def check_count(i, s):
    global max_s, max_count
    if i > max_count:
        max_count = i
        max_s = s
        print(f"Max s: {max_s}, max count: {max_count}")

def isqrt_v3(s: int) -> int:
    if s <= 1:
        return s
    bits = int.bit_length(s) - 2
    x0 = (1 << (bits >> 1)) * (2 + (bits & 1))
    x1 = (x0 + s // x0) // 2
    if x1 >= x0: return x0
    #check_count(1, s)
    x0 = (x1 + s // x1) // 2
    if x0 >= x1: return x1
    #check_count(2, s)
    x1 = (x0 + s // x0) // 2
    if x1 >= x0: return x0
    #check_count(3, s)
    x0 = (x1 + s // x1) // 2
    if x0 >= x1: return x1
    #check_count(4, s)
    assert (x0 + s // x0) // 2 >= x0
    return x0

# print('v1')
# max_s = 0
# max_count = 0

# for i in range(0, 1 << 32, 200):
#     assert math.isqrt(i) == isqrt(i), f"Mismatch for {i}: {math.isqrt(i)} != {isqrt(i)}"

# print('v2')
# max_s = 0
# max_count = 0

# for i in range(0, 1 << 32, 200):
#     assert math.isqrt(i) == isqrt2(i), f"Mismatch for {i}: {math.isqrt(i)} != {isqrt2(i)}"



print('v3')
max_s = 0
max_count = 0

for i in range(0, 1 << 32, 100):
    assert math.isqrt(i) == isqrt_v3(i), f"Mismatch for {i}: {math.isqrt(i)} != {isqrt_v3(i)}"

print(f"Max s: {max_s}, max count: {max_count}")
