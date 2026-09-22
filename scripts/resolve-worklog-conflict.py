import re

with open('/home/z/my-project/worklog.md', encoding='utf-8') as f:
    content = f.read()

# Split at conflict markers
m = re.search(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> 311f32a[^\n]*\n', content, re.S)
head_side, my_side = m.group(1), m.group(2)

# From my side: locate the Task 5 section (skip the stale Task-4 stage-summary fragment)
marker = '---\nTask ID: 5'
idx = my_side.find(marker)
my_appendix = my_side[idx:] if idx >= 0 else my_side
fragment = my_side[:idx].strip() if idx > 0 else ''

addition = ''
if fragment:
    addition += (
        '---\n'
        'Task ID: 4 (تكملة من فرع r26 المحلي)\n'
        'Agent: Main (Super Z)\n'
        'Task: إتمام الـ push إلى GitHub بـ PAT (سجل تاريخي من الفرع المحلي)\n\n'
        'Stage Summary:\n' + fragment + '\n\n'
    )
addition += my_appendix

resolved = content[:m.start()] + head_side + '\n\n' + addition + '\n'
with open('/home/z/my-project/worklog.md', 'w', encoding='utf-8') as f:
    f.write(resolved)
print("resolved, markers left:", resolved.count('<<<<<<<') + resolved.count('>>>>>>>'))
