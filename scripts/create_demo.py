from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo"
OUTPUT = DEMO / "xguard-ai-build-x-demo.mp4"
WIDTH, HEIGHT = 1920, 1080
FONT = "C:/Windows/Fonts/arial.ttf"


def font(size):
    return ImageFont.truetype(FONT, size)


def fit_image(path):
    source = Image.open(path).convert("RGB")
    source.thumbnail((1780, 820), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (WIDTH, HEIGHT), (12, 18, 28))
    left = (WIDTH - source.width) // 2
    top = 105 + (820 - source.height) // 2
    canvas.paste(source, (left, top))
    return canvas


def caption(image, title, subtitle):
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 90), fill=(20, 31, 48))
    draw.text((70, 24), title, fill=(240, 247, 255), font=font(34))
    draw.text((70, 955), subtitle, fill=(183, 211, 230), font=font(26))
    return image


def title_slide(title, subtitle):
    image = Image.new("RGB", (WIDTH, HEIGHT), (12, 18, 28))
    draw = ImageDraw.Draw(image)
    draw.text((120, 330), title, fill=(240, 247, 255), font=font(82))
    draw.text((125, 455), subtitle, fill=(91, 198, 255), font=font(42))
    draw.text((125, 570), "Built for X Layer · User-controlled signing", fill=(183, 211, 230), font=font(30))
    return image


segments = [
    ("title", 10, "XGuard AI", "AI-powered transaction risk intelligence for X Layer"),
    ("production-home.png", 14, "Production · xguard-ai-six.vercel.app", "Review transaction intent before you sign."),
    ("ai-analysis.png", 18, "Safe Transaction · Real AI Analysis", "LOW risk · score, reasons, and recommendation returned by the configured provider."),
    ("high-risk.png", 26, "High Risk · Real AI Analysis", "Zero address · unlimited approval · suspicious context · unknown contract."),
    ("high-risk.png", 15, "User Confirmation", "XGuard AI never signs automatically. The user reviews before Record on X Layer."),
    ("explorer-tx.png", 22, "Verified X Layer Testnet Interaction", "Receipt success · recordAssessment · RiskAssessmentRecorded · risk score 12."),
    ("title", 18, "Architecture", "Deterministic Local Risk Engine + configurable AI explanation + on-chain evidence."),
    ("title", 8, "XGuard AI", "Live Demo: xguard-ai-six.vercel.app · GitHub: github.com/leafwithered/xguard-ai"),
]


with tempfile.TemporaryDirectory(prefix="xguard-demo-") as temp:
    temp_path = Path(temp)
    list_path = temp_path / "concat.txt"
    lines = []
    for index, (source, duration, title, subtitle) in enumerate(segments):
        if source == "title":
            image = title_slide(title, subtitle)
        else:
            image = caption(fit_image(DEMO / source), title, subtitle)
        frame = temp_path / f"slide-{index:02d}.png"
        image.save(frame)
        lines.extend([f"file '{frame.as_posix()}'", f"duration {duration}"])
    lines.append(f"file '{(temp_path / 'slide-07.png').as_posix()}'")
    list_path.write_text("\n".join(lines), encoding="utf-8")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(list_path), "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUTPUT)]
    subprocess.run(command, check=True)

print(OUTPUT)
