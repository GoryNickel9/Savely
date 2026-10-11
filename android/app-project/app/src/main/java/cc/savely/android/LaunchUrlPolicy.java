package cc.savely.android;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.UUID;

/** Origin validation shared by the exported entry point and the private TWA activity. */
final class LaunchUrlPolicy {
    static final String HOME_URL = "https://www.savely.cc/";
    static final String REOPEN_PARAMETER = "savely_android_open";

    private LaunchUrlPolicy() {}

    static boolean isTrustedUrl(String candidate) {
        if (candidate == null) {
            return false;
        }
        try {
            URI uri = new URI(candidate);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && ("www.savely.cc".equalsIgnoreCase(uri.getHost())
                            || "savely.cc".equalsIgnoreCase(uri.getHost()))
                    && uri.getRawUserInfo() == null
                    && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (URISyntaxException invalidUri) {
            return false;
        }
    }

    /** A distinct navigation URL avoids simply focusing an already-loaded home document.
     * Browser caching still follows HTTP headers; this does not implement offline updates.
     */
    static String newHomeUrl() {
        return HOME_URL + "?" + REOPEN_PARAMETER + "=" + UUID.randomUUID();
    }

    static String resolve(String candidate, boolean isViewAction) {
        if (!isViewAction || !isTrustedUrl(candidate)) {
            return newHomeUrl();
        }
        URI uri = URI.create(candidate);
        if ("www.savely.cc".equalsIgnoreCase(uri.getHost())) {
            return candidate;
        }
        // Replace the legacy origin without decoding recovery credentials or feature parameters.
        return "https://www.savely.cc"
                + (uri.getRawPath().isEmpty() ? "/" : uri.getRawPath())
                + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery())
                + (uri.getRawFragment() == null ? "" : "#" + uri.getRawFragment());
    }
}
