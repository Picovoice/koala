#
# Copyright 2023 Picovoice Inc.
#
# You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
# file accompanying this source.
#
# Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
# an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#

import os
import shutil

import setuptools

# os.system('git clean -dfx')

package_folder = os.path.join(os.path.dirname(__file__), 'pvkoala')
if os.path.exists(package_folder):
    shutil.rmtree(package_folder)
os.mkdir(package_folder)

shutil.copy(os.path.join(os.path.dirname(__file__), '../../LICENSE'), package_folder)

shutil.copy(os.path.join(os.path.dirname(__file__), '__init__.py'), os.path.join(package_folder, '__init__.py'))
shutil.copy(os.path.join(os.path.dirname(__file__), 'koala.py'), os.path.join(package_folder, 'koala.py'))
shutil.copy(os.path.join(os.path.dirname(__file__), 'util.py'), os.path.join(package_folder, 'util.py'))

# platforms = ('jetson', 'linux', 'mac', 'raspberry-pi', 'windows')
#
# os.mkdir(os.path.join(package_folder, 'lib'))
# for platform in ('common',) + platforms:
#     shutil.copytree(
#         os.path.join(os.path.dirname(__file__), '../../lib', platform),
#         os.path.join(package_folder, 'lib', platform))

MANIFEST_IN = """
include pvkoala/LICENSE
include pvkoala/__init__.py
include pvkoala/koala.py
include pvkoala/util.py
recursive-include pvkoala/lib/ *
"""

with open(os.path.join(os.path.dirname(__file__), 'MANIFEST.in'), 'w') as f:
    f.write(MANIFEST_IN.strip('\n '))

with open(os.path.join(os.path.dirname(__file__), 'README.md'), 'r') as f:
    long_description = f.read()

setuptools.setup(
    name="pvkoala",
    version="1.0.0",
    author="Picovoice",
    author_email="hello@picovoice.ai",
    description="Koala Noise Suppression Engine.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Picovoice/koala",
    packages=["pvkoala"],
    include_package_data=True,
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Topic :: Multimedia :: Sound/Audio :: Speech"
    ],
    python_requires='>=3.5',
    keywords="Noise Suppression, Speech Enhancement, Noise Removal",
)
