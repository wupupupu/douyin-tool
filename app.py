from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import csv
import json
import os
import io
from datetime import datetime
from collections import defaultdict
import statistics
import re

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# 基于脚本所在目录的绝对路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
DATA_FILE = os.path.join(BASE_DIR, 'data_storage.json')

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {'videos': [], 'topics': [], 'calendar': [], 'comment_templates': []}


def save_data():
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data_storage, f, ensure_ascii=False, indent=2)


data_storage = load_data()


@app.route('/')
def index():
    return render_template('index.html')


def parse_number(value):
    """安全解析数字，处理千位分隔符、空值等情况"""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    s = str(value).strip()
    if not s or s in ('-', '--', 'N/A', 'NA', 'null', 'None'):
        return 0
    s = s.replace(',', '').replace('，', '').replace(' ', '')
    s = re.sub(r'[^\d.]', '', s)
    if not s or s == '.':
        return 0
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return 0


@app.route('/api/upload-csv', methods=['POST'])
def upload_csv():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有上传文件'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '文件名为空'}), 400
    if not file.filename.lower().endswith('.csv'):
        return jsonify({'success': False, 'error': '请上传CSV文件（.csv后缀）'}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # 调试：打印文件信息
        file_size = os.path.getsize(filepath)
        print(f'[UPLOAD] 文件已保存: {filepath}, 大小: {file_size} bytes')

        raw_content = None
        used_encoding = None
        for encoding in ['utf-8-sig', 'utf-8', 'gbk', 'gb2312', 'latin-1']:
            try:
                with open(filepath, 'r', encoding=encoding) as f:
                    raw_content = f.read()
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue

        print(f'[UPLOAD] 编码: {used_encoding}')
        print(f'[UPLOAD] 前200字符: {repr(raw_content[:200])}')

        if raw_content is None:
            os.remove(filepath)
            return jsonify({'success': False, 'error': '无法识别文件编码，请保存为UTF-8格式'}), 400

        reader = csv.DictReader(io.StringIO(raw_content))
        fieldnames = reader.fieldnames
        print(f'[UPLOAD] CSV列名: {fieldnames}')

        if fieldnames is None:
            os.remove(filepath)
            return jsonify({'success': False, 'error': 'CSV文件为空或格式不正确'}), 400

        # 建立列名映射（兼容不同命名）
        col_map = {}
        for f in fieldnames:
            f_clean = f.strip()
            fl = f_clean.lower()
            if '标题' in f_clean or 'title' in fl:
                col_map['title'] = f
            elif '播放' in f_clean or 'view' in fl:
                col_map['views'] = f
            elif '点赞' in f_clean or 'like' in fl or '赞' in f_clean:
                col_map['likes'] = f
            elif '评论' in f_clean or 'comment' in fl:
                col_map['comments'] = f
            elif '分享' in f_clean or 'share' in fl or '转发' in f_clean:
                col_map['shares'] = f
            elif '发布时间' in f_clean or 'post_time' in fl or '时刻' in f_clean:
                col_map['post_time'] = f
            elif '日期' in f_clean or 'date' in fl or ('时间' in f_clean and '发布' not in f_clean):
                col_map['date'] = f
            elif 'ip' in fl or '角色' in f_clean:
                col_map['ip'] = f
            elif '风格' in f_clean or '标签' in f_clean or 'style' in fl:
                col_map['style'] = f

        print(f'[UPLOAD] 列名映射: {col_map}')

        # 回退：精确匹配
        def get_col(row, key, exact_name):
            if key in col_map:
                return row.get(col_map[key], '')
            return row.get(exact_name, '')

        videos = []
        skipped = 0
        for i, row in enumerate(reader):
            try:
                views = parse_number(get_col(row, 'views', '播放量'))
                likes = parse_number(get_col(row, 'likes', '点赞数'))
                comments = parse_number(get_col(row, 'comments', '评论数'))
                shares = parse_number(get_col(row, 'shares', '分享数'))

                if i < 3:
                    print(f'[UPLOAD] Row {i}: views={views}, likes={likes}, comments={comments}')

                if views == 0 and likes == 0:
                    skipped += 1
                    print(f'[UPLOAD] Row {i}: SKIPPED (views=0 and likes=0)')
                    continue

                video = {
                    'title': get_col(row, 'title', '视频标题').strip() or '无标题',
                    'likes': likes,
                    'comments': comments,
                    'shares': shares,
                    'views': views,
                    'date': get_col(row, 'date', '发布日期').strip(),
                    'ip': get_col(row, 'ip', 'IP角色').strip(),
                    'style': get_col(row, 'style', '风格标签').strip(),
                    'post_time': get_col(row, 'post_time', '发布时间').strip()
                }
                if video['views'] > 0:
                    video['like_rate'] = round((video['likes'] / video['views']) * 100, 2)
                    video['comment_rate'] = round((video['comments'] / video['views']) * 100, 2)
                else:
                    video['like_rate'] = 0
                    video['comment_rate'] = 0
                videos.append(video)
            except Exception as e:
                skipped += 1
                print(f'[UPLOAD] Row {i} ERROR: {e}')
                continue

        print(f'[UPLOAD] 有效视频: {len(videos)}, 跳过: {skipped}')

        os.remove(filepath)

        if not videos:
            return jsonify({
                'success': False,
                'error': f'没有解析到有效数据。CSV列名: {fieldnames}。请确认列名包含: 视频标题, 播放量, 点赞数, 评论数, 发布日期',
                'debug_fieldnames': str(fieldnames),
                'debug_mapping': str(col_map)
            }), 400

        data_storage['videos'] = videos
        save_data()

        stats = calculate_stats(videos)
        viral_features = extract_viral_features(videos)
        posting_time_analysis = analyze_best_posting_times(videos)

        return jsonify({
            'success': True,
            'message': f'成功导入 {len(videos)} 条视频数据' + (f'（跳过 {skipped} 条无效行）' if skipped else ''),
            'stats': stats,
            'viral_features': viral_features,
            'posting_time_analysis': posting_time_analysis,
            'videos': videos[:100]
        })

    except Exception as e:
        return jsonify({'success': False, 'error': f'处理失败: {str(e)}'}), 500


def calculate_stats(videos):
    if not videos:
        return {
            'total_videos': 0,
            'avg_likes': 0,
            'avg_comments': 0,
            'avg_like_rate': 0,
            'avg_comment_rate': 0,
            'max_likes': 0,
            'min_likes': 0,
            'total_likes': 0,
            'total_comments': 0,
            'ip_performance': [],
            'style_performance': [],
            'trend_data': []
        }

    likes = [v['likes'] for v in videos]
    comments = [v['comments'] for v in videos]
    like_rates = [v.get('like_rate', 0) for v in videos]
    comment_rates = [v.get('comment_rate', 0) for v in videos]

    stats = {
        'total_videos': len(videos),
        'avg_likes': round(statistics.mean(likes), 1) if likes else 0,
        'avg_comments': round(statistics.mean(comments), 1) if comments else 0,
        'avg_like_rate': round(statistics.mean(like_rates), 2) if like_rates else 0,
        'avg_comment_rate': round(statistics.mean(comment_rates), 2) if comment_rates else 0,
        'max_likes': max(likes) if likes else 0,
        'min_likes': min(likes) if likes else 0,
        'total_likes': sum(likes),
        'total_comments': sum(comments),
        'ip_performance': get_ip_stats(videos),
        'style_performance': get_style_stats(videos),
        'trend_data': get_trend_data(videos)
    }
    return stats


def get_ip_stats(videos):
    ip_stats = defaultdict(lambda: {'count': 0, 'total_likes': 0, 'total_comments': 0})
    for v in videos:
        ip = v['ip'] if v['ip'] else '未分类'
        ip_stats[ip]['count'] += 1
        ip_stats[ip]['total_likes'] += v['likes']
        ip_stats[ip]['total_comments'] += v['comments']

    result = []
    for ip, data in ip_stats.items():
        result.append({
            'name': ip,
            'count': data['count'],
            'avg_likes': round(data['total_likes'] / data['count'], 1),
            'avg_comments': round(data['total_comments'] / data['count'], 1)
        })
    return sorted(result, key=lambda x: x['avg_likes'], reverse=True)


def get_style_stats(videos):
    style_stats = defaultdict(lambda: {'count': 0, 'total_likes': 0})
    for v in videos:
        style = v['style'] if v['style'] else '未分类'
        style_stats[style]['count'] += 1
        style_stats[style]['total_likes'] += v['likes']

    result = []
    for style, data in style_stats.items():
        result.append({
            'name': style,
            'count': data['count'],
            'avg_likes': round(data['total_likes'] / data['count'], 1)
        })
    return sorted(result, key=lambda x: x['avg_likes'], reverse=True)


def get_trend_data(videos):
    trend = defaultdict(lambda: {'likes': [], 'comments': []})
    for v in videos:
        date = v['date'] if v['date'] else '未知日期'
        trend[date]['likes'].append(v['likes'])
        trend[date]['comments'].append(v['comments'])

    result = []
    for date in sorted(trend.keys()):
        day_likes = trend[date]['likes']
        day_comments = trend[date]['comments']
        result.append({
            'date': date,
            'avg_likes': round(statistics.mean(day_likes), 1) if day_likes else 0,
            'avg_comments': round(statistics.mean(day_comments), 1) if day_comments else 0
        })
    return result


# ==================== 爆款特征提取 ====================

STOP_WORDS = {'翻跳', '舞蹈', '挑战', '视频', '一个', '这个', '什么', '怎么',
              '就是', '不是', '已经', '还是', '可以', '没有', '这个', '那个',
              'the', 'a', 'is', 'of', 'and', 'in', 'to', 'for'}


def extract_viral_features(videos):
    if len(videos) < 5:
        return None

    like_rates = [v.get('like_rate', 0) for v in videos]
    views_list = [v['views'] for v in videos]
    avg_rate = statistics.mean(like_rates) if like_rates else 0
    median_views = statistics.median(views_list) if views_list else 0
    threshold = avg_rate * 2

    viral = [v for v in videos
             if v.get('like_rate', 0) >= threshold and v['views'] >= median_views]

    if len(viral) < 2:
        return {'viral_count': len(viral), 'recommendation': '暂未发现明显爆款规律，建议继续积累数据'}

    # IP 统计
    ip_counter = defaultdict(int)
    for v in viral:
        ip = v['ip'] if v['ip'] else '未分类'
        ip_counter[ip] += 1
    top_ips = sorted(ip_counter.items(), key=lambda x: x[1], reverse=True)[:5]
    top_ips_list = [{'name': k, 'count': v} for k, v in top_ips]

    # 风格统计
    style_counter = defaultdict(int)
    for v in viral:
        s = v['style'] if v['style'] else '未分类'
        style_counter[s] += 1
    top_styles = sorted(style_counter.items(), key=lambda x: x[1], reverse=True)[:5]
    top_styles_list = [{'name': k, 'count': v} for k, v in top_styles]

    # 标题关键词提取
    keyword_counter = defaultdict(int)
    for v in viral:
        title = v['title']
        if len(title) < 3:
            continue
        # 字符级 2-gram 和 3-gram
        for n in [2, 3]:
            for i in range(len(title) - n + 1):
                gram = title[i:i + n]
                if gram not in STOP_WORDS and len(gram.strip()) == n:
                    keyword_counter[gram] += 1
    top_keywords = sorted(keyword_counter.items(), key=lambda x: x[1], reverse=True)[:10]
    top_keywords_list = [{'word': k, 'count': v} for k, v in top_keywords]

    # 生成推荐语
    parts = []
    if top_ips:
        parts.append(top_ips[0][0])
    if top_styles:
        parts.append(top_styles[0][0])
    if top_keywords:
        parts.append(top_keywords[0][0] + '主题')
    viral_rate = round(len(viral) / len(videos) * 100, 1)

    if len(parts) >= 2:
        recommendation = f"{' + '.join(parts)}最容易火，爆款率{viral_rate}%"
    else:
        recommendation = f"爆款率{viral_rate}%，建议多尝试不同IP和风格组合"

    return {
        'viral_count': len(viral),
        'viral_threshold': round(threshold, 2),
        'top_ips': top_ips_list,
        'top_styles': top_styles_list,
        'top_keywords': top_keywords_list,
        'recommendation': recommendation
    }


# ==================== 最佳发布时间分析 ====================

def analyze_best_posting_times(videos):
    hours = defaultdict(lambda: {'likes': [], 'like_rates': [], 'count': 0})

    for v in videos:
        pt = v.get('post_time', '')
        if not pt:
            continue
        try:
            hour = int(pt.strip().split(':')[0])
            if 0 <= hour <= 23:
                hours[hour]['likes'].append(v['likes'])
                hours[hour]['like_rates'].append(v.get('like_rate', 0))
                hours[hour]['count'] += 1
        except (ValueError, IndexError):
            continue

    hourly_data = []
    for h in range(24):
        if hours[h]['count'] > 0:
            hourly_data.append({
                'hour': h,
                'hour_label': f'{h}:00',
                'avg_likes': round(statistics.mean(hours[h]['likes']), 1),
                'avg_like_rate': round(statistics.mean(hours[h]['like_rates']), 2),
                'video_count': hours[h]['count']
            })
        else:
            hourly_data.append({
                'hour': h, 'hour_label': f'{h}:00',
                'avg_likes': 0, 'avg_like_rate': 0, 'video_count': 0
            })

    has_data = any(h['video_count'] > 0 for h in hourly_data)

    if has_data:
        best_times = sorted(
            [h for h in hourly_data if h['video_count'] > 0],
            key=lambda h: h['avg_likes'], reverse=True
        )[:3]
        best_hours = [str(t['hour']) + ':00' for t in best_times]
        recommendation = '最佳发布时间: ' + ' / '.join(best_hours)
    else:
        best_times = []
        recommendation = '暂无发布时间数据（CSV中缺少"发布时间"列）'

    return {
        'hourly_data': hourly_data,
        'best_times': best_times,
        'has_data': has_data,
        'recommendation': recommendation
    }


@app.route('/api/data/clear', methods=['POST'])
def clear_data():
    data_storage['videos'] = []
    save_data()
    return jsonify({'success': True, 'message': '数据已清除'})


@app.route('/api/topics', methods=['GET'])
def get_topics():
    return jsonify(data_storage['topics'])


@app.route('/api/topics', methods=['POST'])
def add_topic():
    data = request.json
    if not data.get('title'):
        return jsonify({'success': False, 'error': '选题标题不能为空'}), 400

    topic = {
        'id': int(datetime.now().timestamp() * 1000),
        'title': data.get('title', '').strip(),
        'category': data.get('category', '其他'),
        'description': data.get('description', '').strip(),
        'reference_url': data.get('reference_url', '').strip(),
        'created_date': datetime.now().strftime('%Y-%m-%d')
    }
    data_storage['topics'].append(topic)
    save_data()
    return jsonify({'success': True, 'topic': topic})


@app.route('/api/topics/<int:topic_id>', methods=['DELETE'])
def delete_topic(topic_id):
    before = len(data_storage['topics'])
    data_storage['topics'] = [t for t in data_storage['topics'] if t['id'] != topic_id]
    if len(data_storage['topics']) == before:
        return jsonify({'success': False, 'error': '未找到对应选题'}), 404
    save_data()
    return jsonify({'success': True})


@app.route('/api/calendar', methods=['GET'])
def get_calendar():
    items = sorted(data_storage['calendar'], key=lambda x: x.get('date', ''))
    return jsonify(items)


@app.route('/api/calendar', methods=['POST'])
def add_calendar_item():
    data = request.json
    if not data.get('date') or not data.get('title'):
        return jsonify({'success': False, 'error': '日期和标题不能为空'}), 400

    item = {
        'id': int(datetime.now().timestamp() * 1000),
        'date': data.get('date'),
        'title': data.get('title', '').strip(),
        'category': data.get('category', '其他'),
        'status': 'planned',
        'notes': data.get('notes', '').strip()
    }
    data_storage['calendar'].append(item)
    save_data()
    return jsonify({'success': True, 'item': item})


@app.route('/api/calendar/<int:item_id>', methods=['PUT'])
def update_calendar_item(item_id):
    data = request.json
    for item in data_storage['calendar']:
        if item['id'] == item_id:
            if 'status' in data:
                item['status'] = data['status']
            if 'title' in data:
                item['title'] = data['title']
            if 'date' in data:
                item['date'] = data['date']
            if 'category' in data:
                item['category'] = data['category']
            if 'notes' in data:
                item['notes'] = data['notes']
            save_data()
            return jsonify({'success': True, 'item': item})
    return jsonify({'success': False, 'error': '项目不存在'}), 404


@app.route('/api/calendar/<int:item_id>', methods=['DELETE'])
def delete_calendar_item(item_id):
    before = len(data_storage['calendar'])
    data_storage['calendar'] = [i for i in data_storage['calendar'] if i['id'] != item_id]
    if len(data_storage['calendar']) == before:
        return jsonify({'success': False, 'error': '未找到对应计划'}), 404
    save_data()
    return jsonify({'success': True})


@app.route('/api/export-data', methods=['GET'])
def export_data():
    export = {
        'videos': data_storage['videos'],
        'topics': data_storage['topics'],
        'calendar': data_storage['calendar'],
        'comment_templates': data_storage.get('comment_templates', []),
        'export_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    return jsonify(export)


# ==================== 品牌合作数据包 ====================

@app.route('/api/brand-package', methods=['GET'])
def brand_package():
    videos = data_storage.get('videos', [])
    if not videos:
        return jsonify({'success': False, 'error': '暂无视频数据，请先上传CSV'}), 400

    total_views = sum(v['views'] for v in videos)
    total_likes = sum(v['likes'] for v in videos)
    total_comments = sum(v['comments'] for v in videos)
    like_rates = [v.get('like_rate', 0) for v in videos]

    top_videos = sorted(videos, key=lambda v: v['likes'], reverse=True)[:10]

    return jsonify({
        'success': True,
        'summary': {
            'total_videos': len(videos),
            'total_views': total_views,
            'total_likes': total_likes,
            'total_comments': total_comments,
            'avg_like_rate': round(statistics.mean(like_rates), 2) if like_rates else 0,
            'avg_likes': round(statistics.mean([v['likes'] for v in videos]), 1),
            'avg_comments': round(statistics.mean([v['comments'] for v in videos]), 1),
            'max_likes': max(v['likes'] for v in videos) if videos else 0
        },
        'top_videos': top_videos,
        'ip_summary': get_ip_stats(videos),
        'style_summary': get_style_stats(videos),
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M')
    })


# ==================== 评论引导文案模板库 ====================

@app.route('/api/comment-templates', methods=['GET'])
def get_comment_templates():
    return jsonify(data_storage.get('comment_templates', []))


@app.route('/api/comment-templates', methods=['POST'])
def add_comment_template():
    data = request.json
    if not data.get('content'):
        return jsonify({'success': False, 'error': '文案内容不能为空'}), 400

    template = {
        'id': int(datetime.now().timestamp() * 1000),
        'content': data.get('content', '').strip(),
        'ip_style': data.get('ip_style', '').strip(),
        'category': data.get('category', '通用'),
        'notes': data.get('notes', '').strip(),
        'created_date': datetime.now().strftime('%Y-%m-%d')
    }
    if 'comment_templates' not in data_storage:
        data_storage['comment_templates'] = []
    data_storage['comment_templates'].append(template)
    save_data()
    return jsonify({'success': True, 'template': template})


@app.route('/api/comment-templates/<int:template_id>', methods=['DELETE'])
def delete_comment_template(template_id):
    templates = data_storage.get('comment_templates', [])
    before = len(templates)
    data_storage['comment_templates'] = [t for t in templates if t['id'] != template_id]
    if len(data_storage['comment_templates']) == before:
        return jsonify({'success': False, 'error': '未找到对应模板'}), 404
    save_data()
    return jsonify({'success': True})


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
