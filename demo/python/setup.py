import os
import shutil

import setuptools


INCLUDE_FILES = ('../../LICENSE', 'koala_demo_file.py', 'koala_demo_mic.py')

os.system('git clean -dfx')

package_folder = os.path.join(os.path.dirname(__file__), 'pvkoalademo')
os.mkdir(package_folder)
manifest_in = ""

for rel_path in INCLUDE_FILES:
    shutil.copy(os.path.join(os.path.dirname(__file__), rel_path), package_folder)
    manifest_in += "include pvkoalademo/%s\n" % os.path.basename(rel_path)

with open(os.path.join(os.path.dirname(__file__), 'MANIFEST.in'), 'w') as f:
    f.write(manifest_in)

with open(os.path.join(os.path.dirname(__file__), 'README.md'), 'r') as f:
    long_description = f.read()

setuptools.setup(
    name="pvkoalademo",
    version="1.0.2",
    author="Picovoice",
    author_email="hello@picovoice.ai",
    description="Koala Noise Suppression Engine demos",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Picovoice/koala",
    packages=["pvkoalademo"],
    install_requires=["pvkoala==1.0.1", "pvrecorder==1.1.1"],
    include_package_data=True,
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Topic :: Multimedia :: Sound/Audio :: Speech"
    ],
    entry_points=dict(
        console_scripts=[
            'koala_demo_file=pvkoalademo.koala_demo_file:main',
            'koala_demo_mic=pvkoalademo.koala_demo_mic:main',
        ],
    ),
    python_requires='>=3.5',
    keywords="Noise Cancellation, Noise Suppression, Noise Removal, Speech Enhancement, Speech Denoising",
)
