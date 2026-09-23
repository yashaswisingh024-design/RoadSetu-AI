from pathlib import Path
import re

path = Path('src/views/ReportPotholeView.tsx')
text = path.read_text()

text = text.replace(
    '      latitude: 19.2312,\n      longitude: 72.9765,',
    '      latitude: 0,\n      longitude: 0,',
)

fallback = re.compile(
    r"      } else {\n"
    r"        if \(active\) {\n"
    r"          if \(res\.isIframeBlocked\) {\n"
    r"            setIsIframeBlocked\(true\);\n"
    r"          }\n\n"
    r"          setHumanLocation\(\{\n"
    r"            road: 'Ghodbunder Road \(SH-42\)',\n"
    r"            area: 'Manpada Sector 4',\n"
    r"            landmark: 'Near Manpada Junction',\n"
    r"            city: 'Thane',\n"
    r"            state: 'Maharashtra',\n"
    r"            country: 'India',\n"
    r"            formattedAddress:\n"
    r"              'Ghodbunder Road, Near Manpada Junction, Thane, Maharashtra',\n"
    r"            latitude: 19\.2312,\n"
    r"            longitude: 72\.9765,\n"
    r"          \}\);\n\n"
    r"          setLocationSuccessText\(\n"
    r"            'Corridor default set'\n"
    r"          \);\n"
    r"        }\n"
    r"      }"
)

replacement = """      } else {
        if (active) {
          if (res.isIframeBlocked) {
            setIsIframeBlocked(true);
          }

          setLocationError(
            res.errorMessage ||
              'Live location could not be detected. Please use Search location or Enter manually.'
          );

          setLocationSuccessText(
            'Location required'
          );
        }
      }"""

text, count = fallback.subn(replacement, text)
if count != 1:
    raise SystemExit(f'Expected one hard-coded location fallback, found {count}')

text = text.replace(
    """                        latitude:
                          humanLocation.latitude ||
                          19.2312,
                        longitude:
                          humanLocation.longitude ||
                          72.9765,""",
    """                        latitude: 0,
                        longitude: 0,""",
)

marker = '  /* ---------------- UPLOAD ---------------- */\n'
if 'const compressImage = (' not in text:
    helper = """  /* ---------------- IMAGE COMPRESSION ---------------- */

  const compressImage = (
    dataUrl: string,
    maxWidth = 1280,
    quality = 0.75
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Unable to prepare image for upload.'));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      image.onerror = () =>
        reject(new Error('Unable to read the selected image.'));

      image.src = dataUrl;
    });
  };

"""
    if marker not in text:
        raise SystemExit('Upload marker not found')
    text = text.replace(marker, helper + marker, 1)

handler = re.compile(
    r"  const handleFileUpload = \(\n"
    r"    e: React\.ChangeEvent<HTMLInputElement>\n"
    r"  \) => \{.*?    reader\.readAsDataURL\(file\);\n"
    r"  \};",
    re.S,
)

new_handler = """  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const compressed = await compressImage(result);

        setPhotoUrl(compressed);
        setBase64Image(compressed);
        showToast('Photo compressed and loaded successfully.', 'success');
      } catch {
        showToast(
          'Unable to process this image. Please try another photo.',
          'error'
        );
      }
    };

    reader.onerror = () =>
      showToast('Unable to read the selected image.', 'error');

    reader.readAsDataURL(file);
  };"""

text, count = handler.subn(new_handler, text)
if count != 1:
    raise SystemExit(f'Expected one upload handler, found {count}')

needle = """  const runAiAnalysisAndSubmit = async (
    overrideDuplicate = false
  ) => {
"""
guard = """  const runAiAnalysisAndSubmit = async (
    overrideDuplicate = false
  ) => {
    const hasRealCoordinates =
      Number.isFinite(humanLocation.latitude) &&
      Number.isFinite(humanLocation.longitude) &&
      (humanLocation.latitude !== 0 || humanLocation.longitude !== 0);

    if (!hasRealCoordinates) {
      setCurrentStep(2);
      setLocationError(
        'A real location is required before submitting. Use GPS, Search location, or Enter manually.'
      );
      showToast(
        'Please confirm the defect location before submitting.',
        'error'
      );
      return;
    }

"""
if needle not in text:
    raise SystemExit('AI submission marker not found')
text = text.replace(needle, guard, 1)

for legacy in ('Ghodbunder Road', 'Manpada Sector 4', '19.2312', '72.9765'):
    if legacy in text:
        raise SystemExit(f'Legacy location remains: {legacy}')

path.write_text(text)
print('ReportPotholeView.tsx updated successfully')
