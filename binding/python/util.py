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
import platform
import subprocess
from typing import *

from koala import *


def _linux_machine():
    machine = platform.machine()
    if machine == 'x86_64':
        return machine
    elif machine == 'aarch64':
        arch_info = '-' + machine
    elif machine == 'armv7l':
        arch_info = ''
    else:
        raise NotImplementedError("Unsupported CPU architecture: `%s`" % machine)

    cpu_info = ''
    try:
        cpu_info = subprocess.check_output(['cat', '/proc/cpuinfo']).decode('utf-8')
        cpu_part_list = [x for x in cpu_info.split('\n') if 'CPU part' in x]
        cpu_part = cpu_part_list[0].split(' ')[-1].lower()
    except Exception as e:
        raise RuntimeError("Failed to identify the CPU with `%s`\nCPU info: `%s`" % (e, cpu_info))

    if '0xd03' == cpu_part:
        return 'cortex-a53' + arch_info
    elif '0xd07' == cpu_part:
        return 'cortex-a57' + arch_info
    elif '0xd08' == cpu_part:
        return 'cortex-a72' + arch_info
    else:
        raise NotImplementedError("Unsupported CPU: `%s`." % cpu_part)


_RASPBERRY_PI_MACHINES = {'cortex-a53', 'cortex-a72', 'cortex-a53-aarch64', 'cortex-a72-aarch64'}
_JETSON_MACHINES = {'cortex-a57-aarch64'}


def default_library_path(relative):
    if platform.system() == 'Darwin':
        if platform.machine() == 'x86_64':
            return os.path.join(os.path.dirname(__file__), relative, 'lib/mac/x86_64/libpv_koala.dylib')
        elif platform.machine() == "arm64":
            return os.path.join(os.path.dirname(__file__), relative, 'lib/mac/arm64/libpv_koala.dylib')
    elif platform.system() == 'Linux':
        linux_machine = _linux_machine()
        if linux_machine == 'x86_64':
            return os.path.join(os.path.dirname(__file__), relative, 'lib/linux/x86_64/libpv_koala.so')
        elif linux_machine in _JETSON_MACHINES:
            return os.path.join(os.path.dirname(__file__), relative, 'lib/jetson/%s/libpv_koala.so' % linux_machine)
        elif linux_machine in _RASPBERRY_PI_MACHINES:
            return os.path.join(
                os.path.dirname(__file__),
                relative,
                'lib/raspberry-pi/%s/libpv_koala.so' % linux_machine)
    elif platform.system() == 'Windows':
        return os.path.join(os.path.dirname(__file__), relative, 'lib/windows/amd64/libpv_koala.dll')

    raise NotImplementedError('Unsupported platform.')


def default_model_path(relative):
    return os.path.join(os.path.dirname(__file__), relative, 'lib/common/koala_params.pv')


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
        model_path = default_model_path('')

    if library_path is None:
        library_path = default_library_path('')

    return Koala(
        access_key=access_key,
        model_path=model_path,
        library_path=library_path)


__all__ = ['create', 'default_library_path', 'default_model_path']
