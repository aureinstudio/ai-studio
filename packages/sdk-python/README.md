# ai-studio Python SDK

Official Python client for the **ai-studio Public API**.

## Install

```bash
pip install ai-studio
```

## Quick start

```python
import os
from ai_studio import AiStudio

client = AiStudio(api_key=os.environ["AI_STUDIO_API_KEY"])

# 1. Create a Studio job
job = client.studio.create(
    topic="Korean cooking basics",
    level="beginner",
    course_category="hobby",
)
print("job_id:", job["job_id"])

# 2. Wait for completion (polling)
result = client.studio.wait(job["job_id"])
print(result["content"])

# 3. Ask the Tutor
reply = client.tutor.ask(message="What is the difference between useEffect and useLayoutEffect?")
print(reply["answer"])

# 4. Tenant analytics
stats = client.analytics.get(days=30)
print(stats)
```

## Context manager

```python
with AiStudio(api_key=...) as client:
    job = client.studio.create(topic="...")
    result = client.studio.wait(job["job_id"])
```

## Error handling

```python
from ai_studio import AiStudioError

try:
    client.studio.create(topic="...")
except AiStudioError as e:
    print(e.status, e.code, e)
    if e.status == 429:
        # rate limit
        pass
```

## License

MIT
