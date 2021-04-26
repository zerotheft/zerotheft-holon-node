import pandas as pd
import json

voter_pool = []
issue = {}
proposals = []
proposal = {}
votes = []
issues = []
user = ""

def clearall():
    voter_pool.clear()
    issues.clear()
    proposals.clear()
    votes.clear()

def load_all_issues(json_filename):
    file_path = 'input_jsons/' + json_filename + '.json'
    data = json.load(open(file_path))
    allData = {key.lower():value for key, value in data.items()}
    summary_totals = allData['yeardata']
    path = allData['actualpath']
    holon = allData['holon']
    subPaths = allData['subpaths']
    allPaths = allData['allpaths']
    link = allData['pagelink']
    umbrellaPaths = allData['umbrellapaths']
    return summary_totals, path, holon, allPaths, subPaths, link, umbrellaPaths


def get_issue_via_loc(loc):
    issue = issues_data.iloc[loc]
    return issue

def load_single_issue(json_filename):
    file_path = 'input_jsons/' + json_filename + '.json'
    data = json.load(open(file_path))
    allData = {key.lower():value for key, value in data.items()}
    summary_totals = allData['yeardata']
    holon = allData['holon']
    path = allData['actualpath']
    allPaths = allData['allpaths']
    return summary_totals, path, holon, allPaths

def get_proposal_via_loc(loc):
    proposal = issues_data.iloc[loc]['proposals'].iloc[loc]
    return proposal

def get_issue_proposals(issue, year = None):
    proposals = []
    if year:
        if len(issue)> 0 and len(issue['proposals']) > 0:
            proposals = [props for props in issue['proposals'] if int(props['year']) == year]
    else:
        proposals = issue['proposals']
    return proposals

def get_issue_alt_proposals(issue, year = None):
    proposals = []
    if year:
        if len(issue)> 0 and len(issue['counter_proposals']) > 0:
            proposals = [props for props in issue['counter_proposals'] if int(props['year']) == year]
    else:
        proposals = issue['counter_proposals']
    return proposals

def get_leaf_paths(paths, pre_path = ''):
    leaf_paths = []
    for p in paths:
        if p in ['parent', 'display_name', 'umbrella', 'leaf']:
            continue
        if paths[p] is None:
            leaf_paths.append(pre_path + p)
        else:
            leaf_paths.extend(get_leaf_paths(paths[p], pre_path + p + '/'))
    return leaf_paths
        
def get_flat_paths(paths, pre_path = ''):
    flat_paths = []
    if not paths is None:
        for p in paths:
            if p in ['parent', 'display_name', 'umbrella', 'leaf']:
                continue
            flat_paths.append(pre_path + p)
            flat_paths.extend(get_flat_paths(paths[p], pre_path + p + '/'))
    
    return flat_paths

def get_path_year_proposals(summary_totals, path, year):
    year_data = summary_totals[str(year)]
    proposals = []
    if 'paths' in year_data and path in year_data['paths']:
        pathData = year_data['paths'][path]
        if 'props' in pathData:
            proposals = [pathData['props'][p] for p in pathData['props']]
    return pd.DataFrame(proposals)

def get_path_year_votes(proposals):
    votes = []
    for voteInfo in proposals.voteInfo:
        votes += [v for v in voteInfo]
    return pd.DataFrame(votes)
    
def get_path_vote_totals(year_totals, path):
    pvt = {}
    if 'paths' in year_totals and path in year_totals['paths']:
        pvt = year_totals['paths'][path]
    return pvt
    