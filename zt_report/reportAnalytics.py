import inputReader
import pandas as pd
import helper
import datetime

def get_issue_summary(issue, year):
    total_votes = { 'against': 0, 'for': 0, 'total': 0 }
    proposals = inputReader.get_issue_proposals(issue, year)
    counter_proposals = inputReader.get_issue_alt_proposals(issue, year)
    year_proposals = proposals + counter_proposals
    leading_prop = None
    counter_leading_prop = None
    all_leading_prop = None
    total_thefts = 0
    for p in year_proposals:
        count = p['votes']
        all_leading_prop = p if all_leading_prop is None or all_leading_prop['votes'] < count else all_leading_prop
    for p in proposals:
        total_votes['for'] += p['votes']
        count = p['votes']
        leading_prop = p if leading_prop is None or leading_prop['votes'] < count else leading_prop
        total_thefts += p['amount']
    for p in counter_proposals:
        total_votes['against'] += p['votes']
        count = p['votes']
        counter_leading_prop = p if counter_leading_prop is None or counter_leading_prop['votes'] < count else leading_prop
    total_votes['total'] = total_votes['for'] + total_votes['against']
    issue_summary = {
        'title': issue['title'],
        'votes_info': total_votes,
        'leading_proposal': leading_prop,
        'counter_leading_prop': counter_leading_prop,
        'all_leading_prop': all_leading_prop,
        'proposal_count': len(proposals) + len(counter_proposals),
        'proposals': proposals,
        'counter_proposals': counter_proposals,
        'total_thefts': total_thefts,
        'url': issue['link'],
        'path': issue['subtitle']
    }
    return issue_summary

def votes_pie_summary(vote_totals):
    return [vote_totals['against'], vote_totals['for']], [ 'Voted NO', 'Voted YES' ]

def proposal_vote_totals_summary_multi(vote_totals, clean_theft = True):
    sums = {}
    for key in vote_totals['props']:
        prop = vote_totals['props'][key]
        theft = prop['theft']

        if theft <= 0:
            continue # skip counter-proposals for this data
            
        ct = prop['count']
        vs = sums.get(theft)
        if vs is None:
            sums[theft] = ct
        else:
            sums[theft] += ct
            
    thefts = []
    votes = []
    ths = list(sums.keys())
    ths.sort()
    for th in ths:
        thv = helper.theft_amount_abbr(th) if clean_theft else th
        thefts.append(thv)
        votes.append(sums[th])
        
    return thefts, votes

def get_issues_summaries(issues, year):
    issue_summaries = []
    if len(issues) > 0:
        for issue in issues:
            issue_summaries.append(get_issue_summary(issue, year))
    return issue_summaries

def prepare_summary_totals(all_issues, actual_path):
    summary_totals = {}
#     for sub in sub_paths:
#         full_sub_path = actual_path + '/' + sub
    for i in all_issues:
        l = len(actual_path.split('/'))
        path_split = i['path'].split('/')
        path = path_split[l:]
        path_l = len(path)
        if path_l == 1:
            print('Leaf', i['path'])
        elif path_l == 2:
            print('Sum of Path Proposals', i['path'])
        else:
            print('------')
            print(actual_path + '/' + ('/').join(path))
            p = actual_path + '/' + ('/').join(path)
#             prepare_summary_totals(all_issues, p)
    summary_totals[year] = {}
    return summary_totals
    
    

def get_total_proposals(issues_summary):
    return sum([issue['proposal_count'] for issue in issues_summary])

def get_path_votes(issues_summary, voteType):
    return sum(issue['votes_info'][voteType] for issue in issues_summary)

def issues_summary_table(issues_summary):
    filter = []
    proposals = []
    counter_proposals = []
    if len(issues_summary) > 0:
        for issue in issues_summary:
            filter.append({
                'title': issue['title'],
                'votes_total': issue['votes_info']['total'],
                'votes_for': issue['votes_info']['against'],
                'votes_against': issue['votes_info']['for'],
                'proposal_count': issue['proposal_count'],
                'url': '',
                'total_thefts': issue['total_thefts'],
                'thefts_amount': helper.theft_amount_abbr(issue['total_thefts'])
            })
            for p in issue['proposals'] or []:
                proposals.append({
                    'title': p['title'],
                    'votes': p['votes'],
                    'url': p['link'],
                    'total_thefts': p['amount'],
                    'thefts_amount': p['summary'],
                    'proposal_hash': p['proposal_hash'],
                    'description': p['description']
                })
            for p in issue['counter_proposals'] or []:
                counter_proposals.append({
                   'title': p['title'],
                    'votes': p['votes'],
                    'url': p['link'],
                    'total_thefts': p['amount'],
                    'thefts_amount': p['summary'],
                    'proposal_hash': p['proposal_hash'],
                    'description': p['description']
                })
    all_proposals = proposals + counter_proposals
    top7_proposals = top7_path_proposals(all_proposals)
    if len(filter) > 0:
        styles = [
          dict(selector="th", props=helper.th_props),
          dict(selector="td", props=helper.td_props),
          dict(selector="tr td:last-child", props=helper.td_last_props)
        ]
        dt_issues = transform_to_dataframes(filter, 'Issues')
        if len(top7_proposals[1:7]) > 0:
            dt_proposals = transform_to_dataframes(top7_proposals[1:7], 'Proposals')
            return dt_issues.style.hide_index().set_table_styles(styles), dt_proposals.style.hide_index().set_table_styles(styles), top7_proposals
        return dt_issues.style.hide_index().set_table_styles(styles), "No proposals registered", top7_proposals
    return "No issue registered", "No proposals registered", top7_proposals

def transform_to_dataframes(obj, title):
    df = pd.concat([pd.DataFrame(obj)])
    df = df.rename(columns=str.title)
    df = df.rename(columns={ 'Title': title })
    df[title] = df.apply(lambda x: helper.make_clickable(x[title], x['Url']), axis = 1)
    df.columns = df.columns.str.replace(r"_", " ", regex=True)
    del df['Url']
    del df['Total Thefts']
    return df
    

def top7_path_proposals(proposals):
    if len(proposals) == 0:
        return []
    proposals.sort(key=lambda s: s['votes'], reverse = True)
    return proposals[0:7]

# def sort_proposals(proposals):
#     if len(proposals) == 0:
#         return []
#     proposals.sort(key=lambda s: s['votes'], reverse = True)
#     return proposals


def get_proposals_table(proposals):
    prd = []
    for prop in proposals:
        prd.append({
            'Theft': prop['summary'],
            'Votes': prop['votes'],
            'Description': '<span style="opacity:0.5">id: <b>' + prop['id'] + '</b></span><br/>' + prop['description'].replace('\n', '<br/>')
        })
    propdf = []
    if len(prd) > 0:
        propdf = pd.DataFrame(prd).sort_values('Votes', ascending = False)

    return propdf

def get_total_thefts(issues):
    total_sum = sum([issue['total_thefts'] for issue in issues])
    return helper.theft_amount_abbr(total_sum)

def get_past_years_theft_for_multi(sumtotals, path, nation = 'USA'):
    year_th = []
    # simple estimator - use the prior theft until it changes
    prior_theft = None
    first_theft = None
    for year in sumtotals:
        if path == nation:
            p = sumtotals[year]
        else:
            paths = sumtotals[year]['paths']
            p = paths.get(path)
        
        yd = { 'Year': year, 'theft': prior_theft, 'Determined By': 'estimation' }
        if p is None or p.get('missing'):
            year_th.append(yd)
            continue
        elif p['_totals']['legit']:
            if p['_totals']['theft'] <= 0:
                yd['Determined By'] = 'incomplete voting'
                yd['theft'] = 0
            else:                
                yd['Determined By'] = 'voting'
                yd['theft'] = p['_totals']['theft']
        else: # not legit
            if p['_totals']['theft'] <= 0:
                yd['Determined By'] = 'incomplete voting'
                yd['theft'] = 0
            else:
                yd['Determined By'] = 'incomplete voting'
                yd['theft'] = p['_totals']['theft']
        first_theft = yd['theft'] if first_theft is None else first_theft
        prior_theft = yd['theft']
        
        year_th.append(yd)

    # second pass - back-fill any early years with first_theft estimate
    for yd in year_th:
        if yd['theft'] is None:
            yd['theft'] = first_theft
            
        yd['Theft'] = helper.theft_amount_abbr(yd['theft'])

    # third pass - step-estimate any theft between two legit/incomplete years
    last_th = None
    last_th_idx = -1
    pre_step = None
    pre_idx = None
    post_step = None
    post_idx = None
    for idx, yd in enumerate(year_th):
        if yd['Determined By'] == 'voting' or yd['Determined By'] == 'incomplete voting':
            # if we had a legit in the past, back-fill all estimation cases between
            step = None
            if last_th and last_th_idx < (idx - 1):
                diff = yd['theft'] - last_th
                gap = idx - last_th_idx
                step = diff / gap
                
                for back_idx in range(last_th_idx + 1, idx):
                    last_th += step
                    year_th[back_idx]['theft'] = last_th
                    year_th[back_idx]['Theft'] = helper.theft_amount_abbr(last_th)
            elif last_th and last_th_idx == (idx - 1):
                step = yd['theft'] - last_th
                
            # prepare for fourth/fifth passes
            if step:
                if pre_step is None and idx > 0:
                    pre_step = step
                    pre_idx = idx
                post_step = step
                post_idx = idx
            
            last_th = yd['theft']
            last_th_idx = idx
        
    # fourth pass - apply pre_step to years before first not missing
    if pre_idx:
        last_th = year_th[pre_idx]['theft']
        for pi in range(pre_idx - 1, -1, -1):
            last_th -= pre_step
            if last_th <= 0:
                year_th[pi]['theft'] = 0
                year_th[pi]['Theft'] = helper.theft_amount_abbr(0) 
            else:
                year_th[pi]['theft'] = last_th
                year_th[pi]['Theft'] = helper.theft_amount_abbr(last_th)

    # fifth pass - apply post_step to years after last not missing
    if post_idx and post_idx < (len(year_th) - 1):
        last_th = year_th[post_idx]['theft']
        for pi in range(post_idx + 1, len(year_th)):
            last_th += post_step
            if last_th <= 0:
                year_th[pi]['theft'] = 0
                year_th[pi]['Theft'] = helper.theft_amount_abbr(0)
            else:
                year_th[pi]['theft'] = last_th
                year_th[pi]['Theft'] = helper.theft_amount_abbr(last_th)
        
    return pd.DataFrame(year_th)

def get_votes_data(proposals, year = None):
    votes = []
    if year:
        props = [props for props in proposals if int(props['year']) == year]
    else:
        props = proposals
    for p in props:
        votesInfo = p['voteInfo'] if len(p['voteInfo']) > 0 else None
        if votesInfo:
            for voteInfo in votesInfo:
                if 'voterId' not in voteInfo:
                    votes.append({
                        'voter': 'Fake Voter',
                        'voter_name': 'Anonymous',
                        'yes': 'N/A',
                        'timestamp': datetime.datetime.strptime(voteInfo['votedDate'][0:10],'%Y-%m-%d'),
                        'proposal': p['id'],
                        'theft': p['summary'],
                        'path': p['path'] if 'path' in p else ''
                    })
                else:
                    votes.append({
                        'voter': voteInfo['voterId'],
                        'voter_name': voteInfo['name'] if 'name' in voteInfo else 'Anonymous',
                        'yes': voteInfo['voteType'] if 'voteType' in voteInfo else 0,
                        'timestamp': datetime.datetime.strptime(voteInfo['votedDate'][0:10],'%Y-%m-%d'),
                        'proposal': p['id'],
                        'theft': p['summary'],
                        'path': p['path'] if 'path' in p else ''
                    })
    return pd.DataFrame(votes)

def ym_to_Month(ym):
    yr = int(ym / 100)
    mo = int(ym % 100)
    return datetime.datetime(year = yr, month = mo, day = 1).strftime('%b %Y')

def get_prop_abbrs_lookup(props, prop_id_key = 'id', include_theft = True):
    prop_names = [ p[prop_id_key] for p in props ]
    
    plookup = {}
    for p in props:
        pn = p[prop_id_key] + '...'
        if include_theft:
            pn = p['name'] + ' (' + pn + ')'
        plookup[p[prop_id_key]] = pn
        
    return plookup

def path_summary(vote_totals, is_summary = False, clean_theft = True):
    summary = {}
    if is_summary:
        thv = helper.theft_amount_abbr(vote_totals['theft']) if clean_theft else vote_totals['theft']
        summary = {
            'total_votes': vote_totals['votes'],
            'total_against': vote_totals['against'],
            'total_for': vote_totals['for'],
            'leading_theft': thv,
            'leading_theft_votes': 0,
            'leading_prop': None
        }
        return summary
    else:
        summary = {
            'total_votes': vote_totals['for'] + vote_totals['against'],
            'total_against': vote_totals['against'],
            'total_for': vote_totals['for'],
            'leading_theft': None,
            'leading_theft_votes': 0,
            'leading_prop': None
        }
    
    leading_prop = None
    for key in vote_totals['props']:
        prop = vote_totals['props'][key]
        # for "leading" proposal, we are going to skip counter-proposals
        if prop['theft'] <= 0:
            continue
        count = prop['count']
        leading_prop = prop if leading_prop is None or leading_prop['count'] < count else leading_prop

    t, v = proposal_vote_totals_summary_multi(vote_totals, clean_theft)
    max_i = None
    max_v = -1
    for i in range(0, len(t)):
        if v[i] > max_v:
            max_v = v[i]
            max_i = i
    if (len(t) > 0):
        summary['leading_theft'] = t[max_i]
    else:
        summary['leading_theft'] = {}
    if (len(v) > 0):
        summary['leading_theft_votes'] = v[max_i]
    else:
        summary['leading_theft_votes'] = {}
        
    summary['leading_proposal'] = leading_prop
    return summary

leaf_page_count = 4 # summary page, 3 pages of YAML (including blanks)
umbrella_page_count = 4 # summary page, 3 pages of YAML (including blanks)
rollup_page_count = 3 # summary page, 2 breakdown table page (including blanks, hoping this will be enough)

def assign_page_numbers(summary_totals_paths, paths, prefix = '', page_no = 1):
    if paths is None:
        return page_no
    
    for p in paths:
        if p in ['parent', 'display_name', 'umbrella', 'leaf']:
            continue
        pp = prefix + p
        if pp in summary_totals_paths:
            st = summary_totals_paths[pp]['_totals']
            st['pageno'] = page_no
            method = st.get('method')
            if method == 'Umbrella Totals':
                page_no += umbrella_page_count
            elif method == 'Sum of Path Proposals':
                page_no += rollup_page_count
            elif 'votes' in st and st['votes'] > 0:
                page_no += leaf_page_count
            else:
                st['pageno'] = -1 # this path's report is not included

        page_no = assign_page_numbers(summary_totals_paths, paths[p], pp + '/', page_no)
    
    return page_no

def yes_no_vote_totals_summary(vote_totals):
    votes = [ vote_totals['against'], vote_totals['for'] ]

    return votes, [ 'NO', 'YES' ]

def split_path(path):
    sp = path.replace('_', ' ').title().split('/')
    st = sp[-1]
    sp.pop()
    sx = ' - '.join(sp)
    return st, sx