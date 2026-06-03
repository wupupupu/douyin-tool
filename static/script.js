// ==================== 初始化 ====================
let chartsInstances = {};

document.addEventListener('DOMContentLoaded', function () {
    setupNavTabs();
    setupUploadArea();
    setupTopicForm();
    setupCalendarForm();
    setupCommentTemplateForm();
    loadTopics();
    loadCalendar();
    loadCommentTemplates();
});

// ==================== 导航标签 ====================
function setupNavTabs() {
    document.querySelectorAll('.nav-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var tabName = this.getAttribute('data-tab');

            document.querySelectorAll('.tab-content').forEach(function (t) {
                t.classList.remove('active');
                t.style.display = 'none';
            });
            document.querySelectorAll('.nav-btn').forEach(function (b) {
                b.classList.remove('active');
            });

            var target = document.getElementById('tab-' + tabName);
            target.classList.add('active');
            target.style.display = '';
            this.classList.add('active');

            if (tabName === 'brand') {
                loadBrandPackage();
            }
        });
    });
}

// ==================== 文件上传 ====================
function setupUploadArea() {
    var uploadArea = document.getElementById('uploadArea');
    var csvFile = document.getElementById('csvFile');

    uploadArea.addEventListener('click', function () {
        csvFile.click();
    });

    csvFile.addEventListener('change', handleFileSelect);

    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.style.background = '#e8ebff';
    });

    uploadArea.addEventListener('dragleave', function () {
        uploadArea.style.background = '#f8f9ff';
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.style.background = '#f8f9ff';
        if (e.dataTransfer.files.length > 0) {
            csvFile.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });
}

function handleFileSelect() {
    var csvFile = document.getElementById('csvFile');
    var file = csvFile.files[0];
    if (!file) return;

    var statusDiv = document.getElementById('uploadStatus');
    statusDiv.innerHTML = '<div class="alert alert-success">'
        + '<span class="spinner"></span> 正在分析数据...</div>';

    var formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload-csv', {
        method: 'POST',
        body: formData
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.success) {
                statusDiv.innerHTML = '<div class="alert alert-success">' + data.message + '</div>';
                showStats(data.stats);
                showViralFeatures(data.viral_features);
                showCharts(data.stats);
                showPostingTimeChart(data.posting_time_analysis);
                showVideosTable(data.videos);
            } else {
                statusDiv.innerHTML = '<div class="alert alert-error">' + (data.error || '未知错误') + '</div>';
            }
        })
        .catch(function (error) {
            statusDiv.innerHTML = '<div class="alert alert-error">上传失败: ' + error.message + '</div>';
        });
}

// ==================== 统计卡片 ====================
function showStats(stats) {
    if (!stats || !stats.total_videos) {
        document.getElementById('statsOverview').style.display = 'none';
        return;
    }

    document.getElementById('statsOverview').style.display = 'block';
    document.getElementById('statTotalVideos').textContent = stats.total_videos || 0;
    document.getElementById('statAvgLikes').textContent = (stats.avg_likes || 0).toFixed(0);
    document.getElementById('statAvgComments').textContent = (stats.avg_comments || 0).toFixed(0);
    document.getElementById('statAvgLikeRate').textContent = (stats.avg_like_rate || 0).toFixed(2) + '%';
    document.getElementById('statAvgCommentRate').textContent = (stats.avg_comment_rate || 0).toFixed(2) + '%';
    document.getElementById('statMaxLikes').textContent = stats.max_likes || 0;
}

// ==================== 图表 ====================
function showCharts(stats) {
    if (!stats) return;

    var hasData = false;

    if (stats.ip_performance && stats.ip_performance.length > 0) {
        document.getElementById('chartsArea').style.display = 'block';
        drawBarChart('ipChart', stats.ip_performance, 'avg_likes', '平均点赞');
        hasData = true;
    }

    if (stats.style_performance && stats.style_performance.length > 0) {
        document.getElementById('chartsArea').style.display = 'block';
        drawDoughnutChart('styleChart', stats.style_performance, 'avg_likes');
        hasData = true;
    }

    if (stats.trend_data && stats.trend_data.length > 0) {
        document.getElementById('chartsArea').style.display = 'block';
        drawTrendChart('trendChart', stats.trend_data);
        hasData = true;
    }

    if (!hasData) {
        document.getElementById('chartsArea').style.display = 'none';
    }
}

function destroyChart(key) {
    if (chartsInstances[key]) {
        chartsInstances[key].destroy();
        delete chartsInstances[key];
    }
}

function drawBarChart(canvasId, data, valueKey, label) {
    destroyChart(canvasId);

    var ctx = document.getElementById(canvasId);
    if (!ctx) return;

    chartsInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(function (d) { return d.name; }),
            datasets: [{
                label: label,
                data: data.map(function (d) { return d[valueKey]; }),
                backgroundColor: 'rgba(102, 126, 234, 0.75)',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function drawDoughnutChart(canvasId, data, valueKey) {
    destroyChart(canvasId);

    var ctx = document.getElementById(canvasId);
    if (!ctx) return;

    var colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b',
        '#fa709a', '#fee140', '#30cfd0', '#a8edea', '#fccb90'];

    chartsInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(function (d) { return d.name; }),
            datasets: [{
                data: data.map(function (d) { return d[valueKey]; }),
                backgroundColor: colors.slice(0, data.length)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 12 } }
                }
            }
        }
    });
}

function drawTrendChart(canvasId, trendData) {
    destroyChart(canvasId);

    var ctx = document.getElementById(canvasId);
    if (!ctx) return;

    chartsInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.map(function (d) { return d.date; }),
            datasets: [{
                label: '平均点赞',
                data: trendData.map(function (d) { return d.avg_likes; }),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.08)',
                tension: 0.3,
                fill: true,
                pointRadius: 3
            }, {
                label: '平均评论',
                data: trendData.map(function (d) { return d.avg_comments; }),
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.08)',
                tension: 0.3,
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// ==================== 视频详情表 ====================
function showVideosTable(videos) {
    if (!videos || videos.length === 0) {
        document.getElementById('videosTableArea').style.display = 'none';
        return;
    }

    document.getElementById('videosTableArea').style.display = 'block';
    var tbody = document.getElementById('videosTableBody');
    tbody.innerHTML = '';

    videos.forEach(function (v) {
        var row = document.createElement('tr');
        row.innerHTML =
            '<td>' + escapeHtml(v.title || '-') + '</td>'
            + '<td>' + escapeHtml(v.ip || '-') + '</td>'
            + '<td>' + (v.views || 0).toLocaleString() + '</td>'
            + '<td>' + (v.likes || 0).toLocaleString() + '</td>'
            + '<td>' + (v.comments || 0).toLocaleString() + '</td>'
            + '<td>' + (v.like_rate || 0).toFixed(2) + '%</td>'
            + '<td>' + (v.comment_rate || 0).toFixed(2) + '%</td>'
            + '<td>' + escapeHtml(v.date || '-') + '</td>';
        tbody.appendChild(row);
    });
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function clearAnalysisData() {
    if (!confirm('确定要清除所有分析数据吗？此操作不可恢复。')) return;

    fetch('/api/data/clear', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                document.getElementById('statsOverview').style.display = 'none';
                document.getElementById('viralFeaturesArea').style.display = 'none';
                document.getElementById('chartsArea').style.display = 'none';
                document.getElementById('postTimeCard').style.display = 'none';
                document.getElementById('videosTableArea').style.display = 'none';
                document.getElementById('uploadStatus').innerHTML = '';
                document.getElementById('csvFile').value = '';
                Object.keys(chartsInstances).forEach(function (k) { destroyChart(k); });
                showToast('数据已清除', 'success');
            }
        });
}

// ==================== 选题库 ====================
function setupTopicForm() {
    document.getElementById('topicForm').addEventListener('submit', function (e) {
        e.preventDefault();
        addTopic();
    });
}

function addTopic() {
    var topic = {
        title: document.getElementById('topicTitle').value.trim(),
        category: document.getElementById('topicCategory').value,
        description: document.getElementById('topicDescription').value.trim(),
        reference_url: document.getElementById('topicUrl').value.trim()
    };

    if (!topic.title) {
        showToast('请输入选题标题', 'error');
        return;
    }

    fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topic)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                document.getElementById('topicForm').reset();
                loadTopics();
                showToast('选题已添加', 'success');
            } else {
                showToast(data.error || '添加失败', 'error');
            }
        })
        .catch(function (e) {
            showToast('添加失败: ' + e.message, 'error');
        });
}

function loadTopics() {
    fetch('/api/topics')
        .then(function (r) { return r.json(); })
        .then(function (topics) {
            var list = document.getElementById('topicsList');
            if (!topics || topics.length === 0) {
                list.innerHTML = '<p class="empty-hint">暂无选题，点击上方添加</p>';
                return;
            }

            list.innerHTML = topics.map(function (t) {
                var desc = t.description ? '<p style="margin-top:6px;color:#555;">' + escapeHtml(t.description) + '</p>' : '';
                var link = t.reference_url
                    ? '<p style="margin-top:4px;"><a href="' + escapeHtml(t.reference_url) + '" target="_blank" rel="noopener">查看参考</a></p>'
                    : '';
                return '<div class="topic-item">'
                    + '<h4>' + escapeHtml(t.title) + '</h4>'
                    + '<div class="topic-meta"><strong>分类:</strong> ' + escapeHtml(t.category || '未分类')
                    + ' | <strong>创建:</strong> ' + escapeHtml(t.created_date || '') + '</div>'
                    + desc + link
                    + '<div class="topic-actions">'
                    + '<button class="btn btn-danger btn-sm" data-delete-topic="' + t.id + '">删除</button>'
                    + '</div></div>';
            }).join('');

            list.querySelectorAll('[data-delete-topic]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    deleteTopic(parseInt(this.getAttribute('data-delete-topic')));
                });
            });
        });
}

function deleteTopic(id) {
    if (!confirm('确定删除这个选题吗？')) return;

    fetch('/api/topics/' + id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                loadTopics();
                showToast('选题已删除', 'success');
            } else {
                showToast(data.error || '删除失败', 'error');
            }
        });
}

// ==================== 发布日历 ====================
function setupCalendarForm() {
    document.getElementById('calendarForm').addEventListener('submit', function (e) {
        e.preventDefault();
        addCalendarItem();
    });
}

function addCalendarItem() {
    var item = {
        date: document.getElementById('calendarDate').value,
        title: document.getElementById('calendarTitle').value.trim(),
        category: document.getElementById('calendarCategory').value,
        notes: document.getElementById('calendarNotes').value.trim()
    };

    if (!item.date || !item.title) {
        showToast('请填写日期和标题', 'error');
        return;
    }

    fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                document.getElementById('calendarForm').reset();
                loadCalendar();
                showToast('发布计划已添加', 'success');
            } else {
                showToast(data.error || '添加失败', 'error');
            }
        })
        .catch(function (e) {
            showToast('添加失败: ' + e.message, 'error');
        });
}

function loadCalendar() {
    fetch('/api/calendar')
        .then(function (r) { return r.json(); })
        .then(function (items) {
            var list = document.getElementById('calendarList');
            if (!items || items.length === 0) {
                list.innerHTML = '<p class="empty-hint">暂无计划，点击上方添加</p>';
                return;
            }

            list.innerHTML = items.map(function (item) {
                var statusText = { 'planned': '计划中', 'published': '已发布', 'abandoned': '已取消' };
                var statusColor = { 'planned': '#667eea', 'published': '#51cf66', 'abandoned': '#999' };
                var notes = item.notes ? '<p style="margin-top:6px;color:#555;"><strong>备注:</strong> ' + escapeHtml(item.notes) + '</p>' : '';

                return '<div class="calendar-item">'
                    + '<h4>' + escapeHtml(item.title) + '</h4>'
                    + '<div class="calendar-meta">'
                    + '<strong>日期:</strong> ' + escapeHtml(item.date)
                    + ' | <strong>分类:</strong> ' + escapeHtml(item.category || '其他')
                    + ' | <strong>状态:</strong> '
                    + '<span style="color:' + statusColor[item.status] + ';font-weight:600;">'
                    + (statusText[item.status] || item.status) + '</span>'
                    + '</div>' + notes
                    + '<div class="calendar-actions">'
                    + '<button class="btn btn-success btn-sm" data-calendar-done="' + item.id + '">标记已发布</button>'
                    + '<button class="btn btn-danger btn-sm" data-calendar-del="' + item.id + '">删除</button>'
                    + '</div></div>';
            }).join('');

            list.querySelectorAll('[data-calendar-done]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    updateCalendarStatus(parseInt(this.getAttribute('data-calendar-done')), 'published');
                });
            });
            list.querySelectorAll('[data-calendar-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    deleteCalendarItem(parseInt(this.getAttribute('data-calendar-del')));
                });
            });
        });
}

function updateCalendarStatus(id, status) {
    fetch('/api/calendar/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                loadCalendar();
                showToast('状态已更新', 'success');
            } else {
                showToast(data.error || '更新失败', 'error');
            }
        });
}

function deleteCalendarItem(id) {
    if (!confirm('确定删除这条计划吗？')) return;

    fetch('/api/calendar/' + id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                loadCalendar();
                showToast('计划已删除', 'success');
            } else {
                showToast(data.error || '删除失败', 'error');
            }
        });
}

// ==================== 数据导出 ====================
function exportAllData() {
    fetch('/api/export-data')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'douyin-data-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('数据已导出', 'success');
        })
        .catch(function (e) {
            showToast('导出失败: ' + e.message, 'error');
        });
}

// ==================== 评论引导文案模板库 ====================
function setupCommentTemplateForm() {
    var form = document.getElementById('commentTemplateForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            addCommentTemplate();
        });
    }
}

function addCommentTemplate() {
    var template = {
        content: document.getElementById('ctContent').value.trim(),
        ip_style: document.getElementById('ctIpStyle').value.trim(),
        category: document.getElementById('ctCategory').value,
        notes: document.getElementById('ctNotes').value.trim()
    };

    if (!template.content) {
        showToast('请输入文案内容', 'error');
        return;
    }

    fetch('/api/comment-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                document.getElementById('commentTemplateForm').reset();
                loadCommentTemplates();
                showToast('文案已添加', 'success');
            } else {
                showToast(data.error || '添加失败', 'error');
            }
        })
        .catch(function (e) {
            showToast('添加失败: ' + e.message, 'error');
        });
}

function loadCommentTemplates() {
    fetch('/api/comment-templates')
        .then(function (r) { return r.json(); })
        .then(function (templates) {
            var list = document.getElementById('commentTemplatesList');
            if (!templates || templates.length === 0) {
                list.innerHTML = '<p class="empty-hint">暂无文案模板，点击上方添加</p>';
                return;
            }

            list.innerHTML = templates.map(function (t) {
                var ipBadge = t.ip_style
                    ? '<span style="display:inline-block;background:#667eea;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:6px;">' + escapeHtml(t.ip_style) + '</span>'
                    : '';
                return '<div class="topic-item">'
                    + '<h4>' + ipBadge + escapeHtml(t.content) + '</h4>'
                    + '<div class="topic-meta">'
                    + '<strong>分类:</strong> ' + escapeHtml(t.category || '通用')
                    + ' | <strong>创建:</strong> ' + escapeHtml(t.created_date || '')
                    + '</div>'
                    + (t.notes ? '<p style="margin-top:4px;color:#666;font-size:13px;">' + escapeHtml(t.notes) + '</p>' : '')
                    + '<div class="topic-actions">'
                    + '<button class="btn btn-danger btn-sm" data-delete-ct="' + t.id + '">删除</button>'
                    + '</div></div>';
            }).join('');

            list.querySelectorAll('[data-delete-ct]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    deleteCommentTemplate(parseInt(this.getAttribute('data-delete-ct')));
                });
            });
        });
}

function deleteCommentTemplate(id) {
    if (!confirm('确定删除这条文案模板吗？')) return;

    fetch('/api/comment-templates/' + id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                loadCommentTemplates();
                showToast('文案已删除', 'success');
            } else {
                showToast(data.error || '删除失败', 'error');
            }
        });
}

// ==================== 工具 ====================
function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
}

// ==================== 爆款特征 ====================
function showViralFeatures(features) {
    var area = document.getElementById('viralFeaturesArea');
    if (!area) return;

    if (!features) {
        area.style.display = 'none';
        return;
    }

    area.style.display = 'block';
    document.getElementById('viralRecommendation').textContent = features.recommendation || '';

    var ipsList = features.top_ips || [];
    document.getElementById('viralTopIPs').innerHTML = ipsList.length > 0
        ? ipsList.map(function (x) { return '<span class="viral-tag">' + escapeHtml(x.name) + ' (' + x.count + '次)</span>'; }).join(' ')
        : '-';

    var stylesList = features.top_styles || [];
    document.getElementById('viralTopStyles').innerHTML = stylesList.length > 0
        ? stylesList.map(function (x) { return '<span class="viral-tag">' + escapeHtml(x.name) + ' (' + x.count + '次)</span>'; }).join(' ')
        : '-';

    var kwList = features.top_keywords || [];
    document.getElementById('viralTopKeywords').innerHTML = kwList.length > 0
        ? kwList.map(function (x) { return '<span class="viral-tag">' + escapeHtml(x.word) + ' (' + x.count + '次)</span>'; }).join(' ')
        : '-';
}

// ==================== 最佳发布时间图表 ====================
function showPostingTimeChart(analysis) {
    var card = document.getElementById('postTimeCard');
    if (!card) return;

    if (!analysis || !analysis.has_data) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    document.getElementById('postTimeRecommendation').textContent = analysis.recommendation || '';

    var hourlyData = analysis.hourly_data || [];
    var bestHours = (analysis.best_times || []).map(function (t) { return t.hour; });

    destroyChart('postTimeChart');
    var ctx = document.getElementById('postTimeChart');
    if (!ctx) return;

    var colors = hourlyData.map(function (d) {
        return bestHours.indexOf(d.hour) >= 0 ? 'rgba(81, 207, 102, 0.85)' : 'rgba(102, 126, 234, 0.55)';
    });

    chartsInstances['postTimeChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hourlyData.map(function (d) { return d.hour_label; }),
            datasets: [{
                label: '平均点赞',
                data: hourlyData.map(function (d) { return d.avg_likes; }),
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            var d = hourlyData[ctx.dataIndex];
                            return '点赞: ' + d.avg_likes + ' | 点赞率: ' + d.avg_like_rate + '% | 视频: ' + d.video_count;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '平均点赞' } },
                x: { title: { display: true, text: '小时' } }
            }
        }
    });
}

// ==================== 品牌合作数据包 ====================
function loadBrandPackage() {
    var container = document.getElementById('brandContent');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">加载中...</p>';

    fetch('/api/brand-package')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.success) {
                container.innerHTML = '<p class="empty-hint">' + (data.error || '暂无数据') + '</p>';
                return;
            }

            var s = data.summary;
            var html = '';

            // 数据摘要卡片
            html += '<div class="brand-summary">';
            html += '<div class="brand-stat"><div class="brand-stat-value">' + (s.total_videos || 0) + '</div><div class="brand-stat-label">总视频数</div></div>';
            html += '<div class="brand-stat"><div class="brand-stat-value">' + (s.total_views || 0).toLocaleString() + '</div><div class="brand-stat-label">总播放量</div></div>';
            html += '<div class="brand-stat"><div class="brand-stat-value">' + (s.total_likes || 0).toLocaleString() + '</div><div class="brand-stat-label">总点赞</div></div>';
            html += '<div class="brand-stat"><div class="brand-stat-value">' + (s.total_comments || 0).toLocaleString() + '</div><div class="brand-stat-label">总评论</div></div>';
            html += '<div class="brand-stat"><div class="brand-stat-value">' + (s.avg_like_rate || 0) + '%</div><div class="brand-stat-label">平均点赞率</div></div>';
            html += '<div class="brand-stat"><div class="brand-stat-value">' + (s.avg_likes || 0).toFixed(0) + '</div><div class="brand-stat-label">平均点赞</div></div>';
            html += '</div>';

            // 头部信息
            html += '<div class="card"><h3>账号数据概览</h3>';
            html += '<table class="data-table"><thead><tr><th>指标</th><th>数值</th></tr></thead><tbody>';
            html += '<tr><td>总视频数</td><td>' + s.total_videos + '</td></tr>';
            html += '<tr><td>总播放量</td><td>' + s.total_views.toLocaleString() + '</td></tr>';
            html += '<tr><td>总点赞</td><td>' + s.total_likes.toLocaleString() + '</td></tr>';
            html += '<tr><td>总评论</td><td>' + s.total_comments.toLocaleString() + '</td></tr>';
            html += '<tr><td>平均点赞率</td><td>' + s.avg_like_rate + '%</td></tr>';
            html += '<tr><td>平均点赞</td><td>' + s.avg_likes.toFixed(0) + '</td></tr>';
            html += '<tr><td>平均评论</td><td>' + s.avg_comments.toFixed(0) + '</td></tr>';
            html += '<tr><td>最高点赞</td><td>' + s.max_likes.toLocaleString() + '</td></tr>';
            html += '</tbody></table></div>';

            // Top 视频
            html += '<div class="card"><h3>Top 10 热门视频</h3>';
            html += '<div class="table-wrapper"><table class="data-table"><thead><tr>';
            html += '<th>#</th><th>标题</th><th>播放量</th><th>点赞</th><th>评论</th><th>点赞率</th><th>日期</th>';
            html += '</tr></thead><tbody>';
            (data.top_videos || []).forEach(function (v, i) {
                html += '<tr>';
                html += '<td>' + (i + 1) + '</td>';
                html += '<td>' + escapeHtml(v.title || '-') + '</td>';
                html += '<td>' + (v.views || 0).toLocaleString() + '</td>';
                html += '<td>' + (v.likes || 0).toLocaleString() + '</td>';
                html += '<td>' + (v.comments || 0).toLocaleString() + '</td>';
                html += '<td>' + (v.like_rate || 0).toFixed(2) + '%</td>';
                html += '<td>' + escapeHtml(v.date || '-') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';

            // IP / 风格分布
            html += '<div class="card"><h3>IP 角色表现</h3>';
            html += '<div class="table-wrapper"><table class="data-table"><thead><tr><th>IP</th><th>视频数</th><th>平均点赞</th><th>平均评论</th></tr></thead><tbody>';
            (data.ip_summary || []).forEach(function (ip) {
                html += '<tr><td>' + escapeHtml(ip.name) + '</td><td>' + ip.count + '</td><td>' + ip.avg_likes + '</td><td>' + ip.avg_comments + '</td></tr>';
            });
            html += '</tbody></table></div></div>';

            html += '<div class="card"><h3>风格标签表现</h3>';
            html += '<div class="table-wrapper"><table class="data-table"><thead><tr><th>风格</th><th>视频数</th><th>平均点赞</th></tr></thead><tbody>';
            (data.style_summary || []).forEach(function (st) {
                html += '<tr><td>' + escapeHtml(st.name) + '</td><td>' + st.count + '</td><td>' + st.avg_likes + '</td></tr>';
            });
            html += '</tbody></table></div></div>';

            html += '<p style="text-align:center;color:#999;font-size:12px;margin-top:8px;">数据生成时间: ' + escapeHtml(data.generated_at || '') + '</p>';

            container.innerHTML = html;
        })
        .catch(function (e) {
            container.innerHTML = '<p class="empty-hint">加载失败: ' + e.message + '</p>';
        });
}

function printBrandPage() {
    window.print();
}

function exportBrandJSON() {
    fetch('/api/brand-package')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'brand-package-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('品牌数据包已导出', 'success');
        })
        .catch(function (e) {
            showToast('导出失败: ' + e.message, 'error');
        });
}
