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

from typing import Optional

from ._koala import Koala
from ._util import default_library_path, default_model_path


def create(
        access_key: str,
        model_path: Optional[str] = None,
        library_path: Optional[str] = None) -> Koala:
    """
    Factory method for Koala noise suppression engine.

    :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
    :param model_path: Absolute path to the file containing model parameters. If not set it will be set to the default
    location.
    :param library_path: Absolute path to Koala's dynamic library. If not set it will be set to the default location.
    """

    if model_path is None:
        model_path = default_model_path()

    if library_path is None:
        library_path = default_library_path()

    return Koala(
        access_key=access_key,
        model_path=model_path,
        library_path=library_path)


__all__ = ['create']
