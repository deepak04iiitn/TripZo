import path from 'path';

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function getUploadRootDir() {
  if (isServerlessRuntime()) {
    // /tmp is the writable location in serverless runtimes like Vercel.
    return path.resolve('/tmp', 'tripzo');
  }
  return process.cwd();
}

export function getUploadsStaticDir() {
  return path.resolve(getUploadRootDir(), 'uploads');
}

export function getProfileUploadsDir() {
  return path.resolve(getUploadRootDir(), 'uploads', 'profiles');
}

export function resolveStoredUploadAbsolutePath(relativePath = '') {
  return path.resolve(getUploadRootDir(), relativePath);
}

