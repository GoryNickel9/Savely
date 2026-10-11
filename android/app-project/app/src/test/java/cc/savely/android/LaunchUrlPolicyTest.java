package cc.savely.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import java.net.URI;

import org.junit.Test;

public final class LaunchUrlPolicyTest {
    @Test
    public void acceptsOnlySavelyHttpsOrigin() {
        assertTrue(LaunchUrlPolicy.isTrustedUrl("https://savely.cc/"));
        assertTrue(LaunchUrlPolicy.isTrustedUrl("https://www.savely.cc/"));
        assertTrue(LaunchUrlPolicy.isTrustedUrl("https://www.savely.cc:443/reset-password?type=recovery"));
        assertTrue(LaunchUrlPolicy.isTrustedUrl("https://savely.cc:443/reset-password?type=recovery"));
        assertTrue(LaunchUrlPolicy.isTrustedUrl("https://SAVELY.CC/auth/callback#access_token=encoded"));
        String[] rejected = {
            null, "", "not a URL", "http://savely.cc/", "https://savely.cc:8443/",
            "https://savely.cc.evil.example/", "https://evil.example/?url=https://savely.cc/",
            "https://savely.cc@evil.example/", "https://user@savely.cc/",
            "https://www.savely.cc.evil.example/", "https://user@www.savely.cc/",
            "http://www.savely.cc/", "https://www.savely.cc:8443/",
            "javascript:alert(1)", "file:///savely.cc/",
            "intent://savely.cc/", "//savely.cc/", "https://savely.cc\\@evil.example/"
        };
        for (String candidate : rejected) {
            assertFalse("Unexpectedly trusted: " + candidate, LaunchUrlPolicy.isTrustedUrl(candidate));
        }
    }

    @Test
    public void preservesAuthenticationAndFeatureLinksExactly() {
        String[] links = {
            "https://www.savely.cc/auth/callback?access_token=a%2Bb&refresh_token=c%2Fd&type=signup",
            "https://www.savely.cc/reset-password?type=recovery#access_token=a%2Bb&refresh_token=c%2Fd",
            "https://www.savely.cc/fire/calculator?income=1234&scenario=personal"
        };
        for (String link : links) {
            assertEquals(link, LaunchUrlPolicy.resolve(link, true));
        }
    }

    @Test
    public void eachIconTapHasADistinctHomeNavigationTarget() throws Exception {
        String first = LaunchUrlPolicy.resolve(null, false);
        String second = LaunchUrlPolicy.resolve(null, false);
        assertNotEquals(first, second);
        URI uri = new URI(first);
        assertEquals("/", uri.getPath());
        assertEquals("www.savely.cc", uri.getHost());
        assertTrue(uri.getQuery().matches("savely_android_open=[0-9a-f-]{36}"));
        assertTrue(LaunchUrlPolicy.isTrustedUrl(first));
    }

    @Test
    public void ignoresDataAttachedToLauncherAndUntrustedViewIntents() {
        String validFeatureUrl = "https://savely.cc/transactions";
        assertTrue(LaunchUrlPolicy.resolve(validFeatureUrl, false).startsWith(LaunchUrlPolicy.HOME_URL + "?"));
        assertTrue(LaunchUrlPolicy.resolve("https://evil.example/", true).startsWith(LaunchUrlPolicy.HOME_URL + "?"));
    }

    @Test
    public void canonicalizesLegacyOriginWithoutChangingEncodedRecoveryData() {
        String legacy = "https://savely.cc/reset-password?type=recovery&token=a%2Bb%2Fc#access_token=d%2Be&refresh_token=f%2Fg";
        assertEquals("https://www.savely.cc/reset-password?type=recovery&token=a%2Bb%2Fc#access_token=d%2Be&refresh_token=f%2Fg",
                LaunchUrlPolicy.resolve(legacy, true));
        assertEquals("https://www.savely.cc/auth/callback?token=%252B#part%20one",
                LaunchUrlPolicy.resolve("https://SAVELY.CC:443/auth/callback?token=%252B#part%20one", true));
        assertEquals(LaunchUrlPolicy.HOME_URL, LaunchUrlPolicy.resolve("https://savely.cc", true));
    }
}
