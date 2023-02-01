import os
import shutil

import setuptools

# os.system('git clean -dfx')

package_folder = os.path.join(os.path.dirname(__file__), 'pvkoalademo')
os.mkdir(package_folder)

shutil.copy(os.path.join(os.path.dirname(__file__), '../../LICENSE'), package_folder)

shutil.copy(
    os.path.join(os.path.dirname(__file__), 'koala_demo_file.py'),
    os.path.join(package_folder, 'koala_demo_file.py'))

shutil.copy(
    os.path.join(os.path.dirname(__file__), 'koala_demo_mic.py'),
    os.path.join(package_folder, 'koala_demo_mic.py'))

with open(os.path.join(os.path.dirname(__file__), 'MANIFEST.in'), 'w') as f:
    f.write('include pvkoalademo/LICENSE\n')
    f.write('include pvkoalademo/koala_demo_file.py\n')
    f.write('include pvkoalademo/koala_demo_mic.py\n')

with open(os.path.join(os.path.dirname(__file__), 'README.md'), 'r') as f:
    long_description = f.read()

setuptools.setup(
    name="pvkoalademo",
    version="1.1.2",
    author="Picovoice",
    author_email="hello@picovoice.ai",
    description="Koala noise suppression engine demos",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Picovoice/koala",
    packages=["pvkoalademo"],
    install_requires=["pvkoala==1.0.0", "pvrecorder==1.1.1"],
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
    keywords="Noise Suppression, Speech Enhancement, Noise Removal",
)
