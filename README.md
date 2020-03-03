<!-- The practice of linking random words to convey a subtle message is getting out of fashion. -->

# Parlance

> Are you deploying this network? Telling everyone you know to install this app? If you or someone else encounters problems, **don't hesitate to file an issue.** There are no templates, no weird processes, nothing. State your problem, be nice and it will be resolved. And yes, **you can file an issue just to chat with me.**

**Can indiscriminate flooding be a viable communication method?**

[I don't know for sure.](https://news.ycombinator.com/item?id=6866972) [Treat this as an experiment.](https://ccronline.sigcomm.org/wp-content/uploads/2019/05/acmdl19-295.pdf)

<!-- Broadcast-only networks have their own weaknesses. Let's not rehash that, I am well aware. Unfortunately broadcast-only is the most practical mode for ad hoc wireless networks. -->

# What does this thing do actually?

You install Parlance on your Android device. The app then tries to connect to other nearby devices to exchange messages. This way, you can send messages to other people without having to depend on internet connectivity.

# This idea [isn't novel.](https://bitmessage.org/wiki/Main_Page) [At all.](https://scuttlebutt.nz/)

<!-- Bitmessage is a usability nightmare. Techies can figure things out but non-technical people can't. Same goes for Scuttlebutt. -->

It is not my intention to create something [novel or interesting.](http://www.servalproject.org/) But right now, there is [no Android app](https://www.opengarden.com/firechat/) that can [form a mesh network.](https://briarproject.org/) A simple design is [better than nothing.](https://www.manyver.se/)

<!-- These app don't work. They are very iffy. -->

# What about spammers? Scalability?

I don't know. [Proof of work](https://bitmessage.org/wiki/Proof_of_work) is used to prevent people from flooding the network with too many messages. The network will inevitably suffer from scalability issues and at that point, I'll [implement something](https://en.wikipedia.org/wiki/Geo-fence) to [make it scale better.](https://developer.android.com/training/safetynet/attestation)

<!-- It is impossible to make the network scale while also adhering to some sort of architectural purity. Ultimately I'll have to rely on heuristics when there are more users. -->

# This network is decentralized, right?

No. Pointlessly connecting to random machines on the internet doesn't serve any purpose. The app connects to every nearby devices and **a centralized server on the internet** to relay messages.

Eventually I'll take [more](https://software.intel.com/en-us/sgx) and [more control](https://developer.android.com/training/articles/security-key-attestation) of the network to [cope with abuse and other issues that may crop up.](https://en.wikipedia.org/wiki/Blind_signature)

<!-- I am sorry, but in the near future you won't be able to use custom software to participate in this network. -->

# Are my messages private?

Yes. [Encryption is the norm now.](https://nacl.cr.yp.to/) In this day and age, it is [outright negligent](https://en.wikipedia.org/wiki/Crypto_Wars) to make an app without proper encryption.

# Wait, I heard that this project is going to participate in [a well-known science fair.](https://www.societyforscience.org/isef/)

Yeah. Wish me luck.

<!-- I don't expect anything beyond some recogntion. -->

# License

MIT License

Copyright (c) 2020 Huỳnh Trần Khanh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

_Note: The links may or may not make sense. If you can't read between the lines, it might be helpful to take a look at the raw Markdown source code._
