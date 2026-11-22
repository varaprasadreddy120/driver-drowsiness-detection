
import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path

# Same eye landmarks used in our Colab project
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

EAR_THRESHOLD = 0.15


MODEL_PATH = Path(__file__).resolve().parent / "face_landmarker.task"
print("Loading model from:", MODEL_PATH)


options = mp.tasks.vision.FaceLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(
        model_asset_path=str(MODEL_PATH)
    ),
    running_mode=mp.tasks.vision.RunningMode.IMAGE,
    num_faces=1
)

landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(
    options
)


def calculate_ear(landmarks, indices, width, height):
    points = [
        np.array([
            landmarks[i].x * width,
            landmarks[i].y * height
        ])
        for i in indices
    ]

    p1, p2, p3, p4, p5, p6 = points

    horizontal = np.linalg.norm(p1 - p4)

    if horizontal == 0:
        return 0.0

    vertical_1 = np.linalg.norm(p2 - p6)
    vertical_2 = np.linalg.norm(p3 - p5)

    return (vertical_1 + vertical_2) / (2 * horizontal)


def detect_eyes(frame):
    height, width = frame.shape[:2]

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=np.ascontiguousarray(rgb_frame)
    )

    result = landmarker.detect(mp_image)

    if not result.face_landmarks:
        return {
            "state": "NO FACE",
            "ear": 0.0,
            "eyes_closed": False
        }

    landmarks = result.face_landmarks[0]

    left_ear = calculate_ear(
        landmarks, LEFT_EYE, width, height
    )

    right_ear = calculate_ear(
        landmarks, RIGHT_EYE, width, height
    )

    average_ear = (left_ear + right_ear) / 2

    eyes_closed = average_ear < EAR_THRESHOLD

    return {
        "state": "EYES CLOSED" if eyes_closed else "EYES OPEN",
        "ear": round(float(average_ear), 4),
        "eyes_closed": bool(eyes_closed)
    }
