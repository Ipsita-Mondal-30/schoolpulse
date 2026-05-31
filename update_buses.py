import json
import re

raw_data = """
1	1	KA 51B 3962 	https://lokkate.tracknerd.io/live/link/00048d8ccbbcf042cc318f3d0c1f418dad664b55
2	1A	KA 51C 4506	https://lokkate.tracknerd.io/live/link/d1566a2167995e06aa71d6acbc95b940179f4f3c
3	2	KA 42 7873	https://lokkate.tracknerd.io/live/link/2c14c507b4562c19adb0d40cdf5b8618e56f0c55
4	2A	KA 51B 8669	https://lokkate.tracknerd.io/live/link/f93c5823422632b3ee0d1bf410592ae26c5efc1e
5	2B	KA 51B 9317	https://lokkate.tracknerd.io/live/link/d5a624a439fd672b73f16b1f373f8e7dd07183eb
6	2C	KA 51B 9030	https://lokkate.tracknerd.io/live/link/089b58fc1235eb902c8486862cf4742af68487db
7	3	KA 51B 4017	https://lokkate.tracknerd.io/live/link/8e8257361c11d8b3cb779e5da79a8e4a201e9107
8	3A	KA 51C 4679	https://lokkate.tracknerd.io/live/link/997498e97d0c8c2d6aecccef031d499660952e8d
9	3B	KA 51B 9031	https://lokkate.tracknerd.io/live/link/47a47090613d38b21c8bdd1cfd3cca9d94207624
10	4	KA 05 AN 9601	https://lokkate.tracknerd.io/live/link/09fc705957651c07d0e5336bae1fc6bb318ca196
11	6	KA 51B 4061	https://lokkate.tracknerd.io/live/link/a7f5eafed02a9626c4da8ac5473fa8f7080f873f
12	6A	KA 05AN 9625	https://lokkate.tracknerd.io/live/link/d7b82403f5cf92790392af4505c9882b86be6032
13	6B	KA 05 AN 9257	https://lokkate.tracknerd.io/live/link/8bb5b6fa5ad34b674919da68f1e8b7f3737609dd
14	6D	KA 51AF 0057	https://lokkate.tracknerd.io/live/link/8991be21f30ea16a1f483ea1931037ecb2f8a68a
15	7	KA 51B 9036	https://lokkate.tracknerd.io/live/link/0b56be4742e95e1082c864fa69b81b199e90608d
16	7A	KA 51B 8672                                                                                                                                                                                                                                                                                                                                                                                                                                                         	https://lokkate.tracknerd.io/live/link/6471264a832233543fa895a69890147421c21e96
17	7B	KA 51B 4015	https://lokkate.tracknerd.io/live/link/bc73f7106657dc9af31e1fb79dbdd118ecc158d9
18	7C	KA 51B 8806	https://lokkate.tracknerd.io/live/link/b951f3129b61ff62e7d6977f84d52b629c20096c
19	7D	KA 51C 5123	https://lokkate.tracknerd.io/live/link/ce1110a242a70303246814bb272c4526026ccf18
20	7E	KA 51AH 2519	https://lokkate.tracknerd.io/live/link/5d4fca181a0c954edcc19c4f89a8fca8fe1d69f2
21	7F	KA 51AF 0058	https://lokkate.tracknerd.io/live/link/7ded188c5e21cf4b62e969427f59964bd45d1fb1
22	7G	KA 51B 9322	https://lokkate.tracknerd.io/live/link/4f322694c2786218d8db59999134b81954e49be8
23	7H	KA 05 AN 9886	https://lokkate.tracknerd.io/live/link/5ba0b664ff1e84dad9f6544767ed499e5622789f
24	7I	KA 51 AJ 1558	https://lokkate.tracknerd.io/live/link/9c542491d27faffe0df872246ca13718b9ff2612
25	8	KA 51C 4478	https://lokkate.tracknerd.io/live/link/8a12ff710ad0e42d77360bb5c90211a196d29a83
26	8A	KA 42 7876	https://lokkate.tracknerd.io/live/link/e49096976ffe4c4e8db9488b8ee2a76b2dd2a2f7
27	9	KA 05 AN 9889	https://lokkate.tracknerd.io/live/link/85bfbb979b6cd9e9b6c6c5dd8bc9bfd8407bca9d
28	9A	KA 51AH 2280	https://lokkate.tracknerd.io/live/link/3a018562ef5d6aacc362e225d5bcfd41f703a301
29	10	KA 05AC 0397	https://lokkate.tracknerd.io/live/link/1561ffe7a77eef7a667ae66d8b32d60642ef6b1d
30	10.1	KA 51B 4019	https://lokkate.tracknerd.io/live/link/43b1bc80bafeb7337c9a666f973cca4ae9ff55db
31	10A	KA 51B 4016	https://lokkate.tracknerd.io/live/link/244b8b9af2eecfdc5781bec20613da1c19417657
32	10A.1	KA 51C 3837	https://lokkate.tracknerd.io/live/link/be631548f30c0f22a8f38c733d92fd998ff72ff7
33	10A.2	KA 04D 6184	https://lokkate.tracknerd.io/live/link/971e84a0abc00856497303936452196142c96a4e
34	10A.3	KA 51AF 0059	https://lokkate.tracknerd.io/live/link/02653cd2509e4af3048739f55d0b8f38297df569
35	10B	KA 05AN 9296	https://lokkate.tracknerd.io/live/link/8894c6880a234c9e7b8aec22ca6aece12da956d7
36	10C	KA 01AC 3564	https://lokkate.tracknerd.io/live/link/d35609902ad2d5d6afa7d8193a3596bcea0aa734
37	10C.1	KA 51AH 2283	https://lokkate.tracknerd.io/live/link/10c6a2fe03ddd072543d991e9a4d69a76e3ebd91
38	10C.2	KA 51C 9624	https://lokkate.tracknerd.io/live/link/3343df2110fa238a3da36fe12fc928650e2b955f
39	10C.3	KA 51B 8345	https://lokkate.tracknerd.io/live/link/fd025328efa42cae4a9805241e3b2e02482161f9
40	10D	KA 05AN 9872	https://lokkate.tracknerd.io/live/link/0197aa0599340be9417d2b066146ff615f3d1fbe
41	10E	KA 51B 3953	https://lokkate.tracknerd.io/live/link/5f30018191824389a3ba2bca044b362a55206a69
42	10F	KA 51B 4012	https://lokkate.tracknerd.io/live/link/3ade0d4e8e2d5806af2b1fb895c1c0c607bbe90a
43	10G	KA 51B 5122	https://lokkate.tracknerd.io/live/link/3434227a0013ed0163f89ee29dcac6dcbbbc8348
44	10H	KA 51B 4020	https://lokkate.tracknerd.io/live/link/ff12b227956fefee5e7f628241bd62b456eaf529
45	10J	KA 51B 8670	https://lokkate.tracknerd.io/live/link/1dba51b08fd984d7a3ee986bf921498c71c0ac8d
46	11	KA 51B 9587	https://lokkate.tracknerd.io/live/link/7e11c938ef3a93f14b27df1346c4ea8a10b0934e
47	11A	KA 51AJ 1566	https://lokkate.tracknerd.io/live/link/200d6d863808091d3bf7e5f06aeb6434af3b3a80
48	12	KA 42 7871	https://lokkate.tracknerd.io/live/link/56c9a985ee239904d005a01afd338a5f4109d963
49	13	KA 05AN 9885	https://lokkate.tracknerd.io/live/link/3925dd97666d67ad960fcb744de6467f305b299c
50	13A	KA 42 7872	https://lokkate.tracknerd.io/live/link/8669a4f5fb2d8984ef4275389e0e3e57ecdf46be
51	14	KA 51AB 5081	https://lokkate.tracknerd.io/live/link/d1e59af4e49c3df6b97ffea00690fe95269ae5ff
52	14A	KA 42 7877 	https://lokkate.tracknerd.io/live/link/af2295da40b43c456d10a9d801e326ffca109294
53	14B	KA 51B 9035	https://lokkate.tracknerd.io/live/link/6aca9cefbe167e01ef0f3f18bf3ab9d0ed1b1f71
54	14C	KA 42 7875	https://lokkate.tracknerd.io/live/link/3206e4cd6aad870cb1442467113abe064a3250a3
55	15	KA 51B 4018	https://lokkate.tracknerd.io/live/link/b00f21bff5af76d99dfbe9aae3ecc0cd8b7eaf6d
56	15A	KA 51B 8668	https://lokkate.tracknerd.io/live/link/0d797fd69baf66ce6b9764933ed8fbf631ea3d73
57	15B	KA 51B 4013	https://lokkate.tracknerd.io/live/link/8da022bd762c09b3ff2f5f7221f43f185375372b
58	15C	KA 05AN 9299	https://lokkate.tracknerd.io/live/link/479eaf8469a550fd936695151fe8a889f0b701c3
59	15D	KA 51D 4045	https://lokkate.tracknerd.io/live/link/c8fb7bc4d5950fc5c08fc65b3130de5547002fd5
60	15E	KA 05 AN 9255	https://lokkate.tracknerd.io/live/link/304fd1877a894116e9779e58fe22ee79f7179dda
61	16	KA 51B 8783	https://lokkate.tracknerd.io/live/link/c6b79b62a0ea77af87b4fa4cdfa008694ac0c34b
62	16A	KA 51B 8671	https://lokkate.tracknerd.io/live/link/b168a268ad55da3e4e719b6fb6abfa6924776a58
63	17	KA 51AF 0055	https://lokkate.tracknerd.io/live/link/9b470d2baa60ac0024ee11ce293ce8f53f7f6a53
64	17A	KA 05 AN 9883	https://lokkate.tracknerd.io/live/link/496c19e611acfad77dcf4b95bbd730550f4cc89b
65	17B	KA 51AF 0056	https://lokkate.tracknerd.io/live/link/7b2a0500e9b8c375c9b2b00d298a48ba442d6997
66	18	KA 42 7874	https://lokkate.tracknerd.io/live/link/7c38da5942403b6be6e03f3b16ccf7ea4550b4c2
67	18A	KA 51B 4021	https://lokkate.tracknerd.io/live/link/79a49fe39e768a9bd798ceaed3514fa0d2334b08
"""

# Load existing JSON
json_path = 'data/info/buses.json'
with open(json_path, 'r') as f:
    buses_data = json.load(f)

# Build a lookup map of existing data by route
buses_map = {b['route']: b for b in buses_data}

# Parse raw text
for line in raw_data.strip().split('\n'):
    parts = re.split(r'\t+', line.strip())
    if len(parts) >= 4:
        sl, route, vehicle, gprs = parts[0], parts[1], parts[2], parts[3]
        
        # Clean up strings
        route = route.strip()
        vehicle = vehicle.strip()
        gprs = gprs.strip()
        
        if route in buses_map:
            buses_map[route]['gprsLink'] = gprs
            buses_map[route]['vehicle'] = vehicle
        else:
            # If a route somehow is completely new or didn't match
            print(f"Warning: Route {route} not found in existing data, adding new.")
            buses_map[route] = {
                "route": route,
                "vehicle": vehicle,
                "driverName": "Unknown",
                "driverPhone": "Unknown",
                "gprsLink": gprs
            }

# Convert map back to list (preserving order as best as we can, or just sort by route isn't good since 1, 1A, etc.)
# Better to use the order in raw_data
final_buses = []
for line in raw_data.strip().split('\n'):
    parts = re.split(r'\t+', line.strip())
    if len(parts) >= 4:
        route = parts[1].strip()
        final_buses.append(buses_map[route])

with open(json_path, 'w') as f:
    json.dump(final_buses, f, indent=2)

print(f"Successfully updated {len(final_buses)} routes in {json_path}")
