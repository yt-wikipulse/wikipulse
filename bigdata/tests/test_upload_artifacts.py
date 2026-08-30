import io
import zipfile

from bigdata.scripts.upload_artifacts import build_package_zip


def test_package_zip_is_importable_as_bigdata():
    names = zipfile.ZipFile(io.BytesIO(build_package_zip())).namelist()

    assert "bigdata/__init__.py" in names
    assert "bigdata/paths.py" in names
    assert "bigdata/runtime.py" in names
    assert "bigdata/jobs/spyt_marts.py" in names
