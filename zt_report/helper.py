import random
import re

def theft_amount_abbr(amt, pos = None):
    suffix = ''
    fmt = '${:,.1f}'
    if amt < 0:
        fmt = '-' + fmt
        amt = -amt
        fmt = '${:,.0f}'
    if amt > 1000000000000:
        suffix = 'T'
        amt /= 1000000000000
        fmt = '${:,.0f}'
    elif amt > 1000000000:
        suffix = 'B'
        amt /= 1000000000
        fmt = '${:,.0f}'
    elif amt > 1000000:
        suffix = 'M'
        amt /= 1000000
        fmt = '${:,.0f}'
    elif amt > 1000:
        suffix = 'K'
        amt /= 1000
        fmt = '${:,.1f}'
    else:
        fmt = '${:,.1f}'.format(amt)
    fmt += suffix
    return fmt.format(amt)

def real_theft_amount(dollar):
    dollar = dollar.replace(',','')
    real_amount = 0
    only_numeric_val = 0
    real_amount = 0
    suffix = dollar[-1:]
    if re.search(r'[T|B|M|K]', dollar):
        only_numerical = float(dollar[1:-1])
    else:
        only_numerical = float(dollar[1:])
    if suffix == 'T':
        real_amount = only_numerical * 1000000000000
    elif suffix == 'B':
        real_amount = only_numerical * 1000000000
    elif suffix == 'M':
        real_amount = only_numerical * 1000000
    elif suffix == 'K':
        real_amount = only_numerical * 1000
    else:
        real_amount = float(dollar[1:])
    return real_amount

def make_clickable(name, url):
    return '<a href="{}" target="_blank">{}</a>'.format(url, name)

def encryptAmount(amount):
    newAmount = amount[1:-1]
    if not newAmount.replace('.','').replace(',','').isdigit():
        return amount
    a2zencryptor = 'zerothfislvandqumbcx'
    pointPlace = '#!@^&*:-+~|'
    encryptedVal = ''
    for i  in range(0, len(newAmount)):
        if (newAmount[i] == '.'):
            encryptedVal += pointPlace[random.randint(1,9)]
        elif (newAmount[i] == ','):
            encryptedVal += random.randint(1, 9)
        else:
            encryptedVal += a2zencryptor[((i % 2) * 10)+ int(newAmount[i])]
    encryptedVal += amount[len(amount) - 1]
    return '$' + encryptedVal[::-1].upper()

def usaPopulation(year):    
    populations = { "2020": 329880000, "2019": 328240000, "2018": 326690000, "2017": 324990000, "2016": 322940000, "2015": 320640000, "2014": 318300000, "2013": 315990000, "2012": 313830000, "2011": 311560000, "2010": 309320000, "2009": 306770000, "2008": 304090000, "2007": 301230000, "2006": 298380000, "2005": 295520000, "2004": 292810000, "2003": 290110000, "2002": 287630000, "2001": 284970000, "2000": 282160000, "1999": 279040000, "1998": 275850000, "1997": 272650000, "1996": 269390000, "1995": 266280000, "1994": 263130000, "1993": 259920000, "1992": 256510000, "1991": 252980000, "1990": 249620000, "1989": 246820000, "1988": 244500000, "1987": 242290000, "1986": 240130000, "1985": 237920000, "1984": 235820000, "1983": 233790000, "1982": 231660000, "1981": 229470000, "1980": 227220000, "1979": 225060000, "1978": 222580000, "1977": 220240000, "1976": 218040000, "1975": 215970000, "1974": 213850000, "1973": 211910000, "1972": 209900000, "1971": 207660000, "1970": 205050000, "1969": 202680000, "1968": 200710000, "1967": 198710000, "1966": 196560000, "1965": 194300000, "1964": 191890000, "1963": 189240000, "1962": 186540000, "1961": 183690000, "1960": 180670000, "1959": 177830000, "1958": 174880000, "1957": 171980000, "1956": 168900000, "1955": 165930000, "1954": 163030000, "1953": 160180000, "1952": 157550000, "1951": 154880000, "1950": 152270000, "1949": 149190000, "1948": 146630000, "1947": 144130000, "1946": 141390000, "1945": 139930000, "1944": 138400000, "1943": 136740000, "1942": 134860000, "1941": 133400000, "1940": 132120000, "1939": 130880000, "1938": 129820000, "1937": 128820000, "1936": 128050000, "1935": 127250000, "1934": 126370000, "1933": 125580000, "1932": 124840000, "1931": 124040000, "1930": 123080000, "1929": 121770000, "1928": 120510000, "1927": 119040000, "1926": 117400000, "1925": 115830000, "1924": 114110000, "1923": 111950000, "1922": 110050000, "1921": 108540000, "1920": 106460000, "1919": 104510000, "1918": 103210000, "1917": 103270000, "1916": 101960000, "1915": 100550000, "1914": 99110000, "1913": 97220000, "1912": 95330000, "1911": 93860000, "1910": 92410000, "1909": 90490000, "1908": 88710000, "1907": 87010000, "1906": 85450000, "1905": 83820000, "1904": 82170000, "1903": 80630000, "1902": 79160000, "1901": 77580000, "1900": 76090000 }
    return populations[year]

def IPFSLink(hash):
    return 'https://ipfs.io/ipfs/{}'.format(hash)

# Number of taxpayers (returns) from 2001
# source: IRS
taxpayer_min_year = 2001
taxpayer_counts = [
    130255237, # 2001
    130076443,
    130423626,
    132226042,
    134372678, # 2005
    138394754,
    142978806,
    142450569,
    140494127,
    142892051, # 2010
    145370240,
    144928472,
    147351299,
    148606578,
    150493263, # 2015
    150272154,
    152235000,
    154444000,
    155798000 # 2019
]

# US citizen count, 2001-2019, in millions
# source: https://www.multpl.com/united-states-population/table/by-year
citizen_min_year = 2001
citizen_counts = [
    284970000, # 2001
    287630000,
    290110000,
    292810000,
    295520000, # 2005
    298380000,
    301230000,
    304090000,
    306770000,
    309320000, # 2010
    311560000,
    313830000,
    315990000,
    318300000,
    320640000, # 2015
    322940000,
    324990000,
    326690000,
    329880000 # 2019
]

def get_people_amounts(year, min_yr, cts):
    yoff = year - min_yr
    if yoff < 0:
        yoff = 0
    elif yoff >= len(cts):
        yoff = len(cts) - 1
    return cts[yoff]

def get_citizen_amounts(year):
    return {
        'citizens': get_people_amounts(year, citizen_min_year, citizen_counts),
        'taxpayers': get_people_amounts(year, taxpayer_min_year, taxpayer_counts)
    }


th_props = [
    ('background', '#F3F3F3'),
    ('text-align', 'center'),
    ('border', '1px solid #D8D8D8'),
    ('box-sizing', 'border-box'),
    ('border-radius', '7px'),
    ('font-family', 'Poppins'),
    ('line-height', '21px')
]

# Set CSS properties for td elements in dataframe
td_props = [
    ('vertical-align', 'top'),
    ('font-size', '14px'),
    ('border','1px solid #DADADA'),
    ('box-sizing', 'border-box'),
    ('border-radius', '6px'),
    ('text-align', 'justify')
]

td_last_props = [
    ('font-size', '10px'),
    ('width', '30%'),
    ('min-width', '70px'),
    ('text-align', 'justify')
]

def prep_yaml(yaml, page_count = 3, max_line_length = 120, lines_per_page = 90, word_truncate_length = 10):
    pages = []
    
    lines = yaml.split('\n')
    total_lines = len(lines)
    page = ''
    page_line_count = 0
    line = None
    line_idx = 0
    indent_s = ''
    current_max_line_length = max_line_length
    first_split_line = True
    
    while line_idx < total_lines:
        line_to_add = ''
        if line is None:
            line = lines[line_idx]
            line_idx += 1
            first_split_line = True
            indent_s = ''
            current_max_line_length = max_line_length
            
        if len(line) < current_max_line_length:
            line_to_add = line
            line = None
        else: # split line
            line_to_add = line[0:current_max_line_length]
            line = line[current_max_line_length:]
            
            if first_split_line:
                indent = len(line) - len(line.lstrip())
                current_max_line_length = max_line_length - indent
                indent_s = ' '*indent
                first_split_line = False
            
            last_space_idx = line_to_add.rfind(' ')
            if last_space_idx < (current_max_line_length - word_truncate_length):
                line_to_add += '-'
            else:
                line = line_to_add[last_space_idx:] + ' ' + line
                line_to_add = line_to_add[0:last_space_idx]
                
            line_to_add = indent_s + line_to_add
        
        if page_line_count >= lines_per_page:
            pages.append(page)
            page_line_count = 0
            page = ''
            
            if len(pages) >= page_count:
                break
            
        page += line_to_add + '\n'
        page_line_count += 1
    
    if page_line_count > 0:
        pages.append(page)
        
    while len(pages) < page_count:
        pages.append('')
    
    return pages
